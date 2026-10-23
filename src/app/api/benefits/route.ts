import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { benefitAssessmentCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateReference } from "@/lib/utils";
import {
  calculateBenefit,
  deriveServiceYears,
  type RuleParams,
} from "@/lib/calculations/benefit-engine";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_READ)
  ) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.benefitAssessment.findMany({
      where,
      include: {
        retirementCase: {
          select: {
            id: true,
            caseReference: true,
            currentStage: true,
            employee: {
              select: {
                staffNumber: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        ruleVersion: { select: { version: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.benefitAssessment.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = benefitAssessmentCreateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;

    const rc = await prisma.retirementCase.findUnique({
      where: { id: data.retirementCaseId },
      include: {
        employee: {
          include: {
            salaryHistory: { orderBy: { effectiveDate: "desc" }, take: 1 },
            serviceHistory: { orderBy: { startDate: "asc" }, take: 1 },
          },
        },
        pensionScheme: {
          include: {
            ruleVersions: {
              where: { status: "APPROVED" },
              orderBy: { effectiveFrom: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!rc) return jsonError("Retirement case not found", 400);
    if (rc.status === "CLOSED" || rc.status === "REJECTED") {
      return jsonError("Cannot assess a closed retirement case", 400);
    }

    let ruleVersionId = data.ruleVersionId || null;
    let ruleVersion = null as {
      id: string;
      version: string;
      rulesJson: unknown;
    } | null;

    if (ruleVersionId) {
      ruleVersion = await prisma.pensionRuleVersion.findUnique({
        where: { id: ruleVersionId },
      });
      if (!ruleVersion) return jsonError("Rule version not found", 400);
      if (ruleVersion && (ruleVersion as { status?: string }).status !== "APPROVED") {
        // re-fetch with status
        const rv = await prisma.pensionRuleVersion.findUnique({ where: { id: ruleVersionId } });
        if (!rv || rv.status !== "APPROVED") {
          return jsonError("Only APPROVED rule versions may be used for calculation", 400);
        }
        ruleVersion = rv;
      }
    } else if (rc.pensionScheme?.ruleVersions[0]) {
      ruleVersion = rc.pensionScheme.ruleVersions[0];
      ruleVersionId = ruleVersion.id;
    }

    // Derive inputs when not provided
    let qualifyingYears = data.qualifyingServiceYears ?? null;
    if (qualifyingYears == null) {
      const start =
        rc.employee.appointmentDate ||
        rc.employee.serviceHistory[0]?.startDate ||
        null;
      const end =
        rc.actualRetirementDate ||
        rc.expectedRetirementDate ||
        new Date();
      qualifyingYears = deriveServiceYears(start, end);
    }

    let finalSalary = data.finalSalary ?? null;
    if (finalSalary == null && rc.employee.salaryHistory[0]) {
      finalSalary = Number(rc.employee.salaryHistory[0].totalEmolument || rc.employee.salaryHistory[0].basicSalary);
    }

    const rules = (ruleVersion?.rulesJson || {
      calculationMethod: "PLACEHOLDER",
      note: "No approved rule version linked.",
    }) as RuleParams;

    const calc =
      qualifyingYears != null && finalSalary != null
        ? calculateBenefit(
            rules,
            {
              qualifyingServiceYears: qualifyingYears,
              finalSalary,
              appointmentDate: rc.employee.appointmentDate,
              retirementDate: rc.expectedRetirementDate,
              dateOfBirth: rc.employee.dateOfBirth,
            },
            {
              ruleVersionId: ruleVersionId || undefined,
              ruleVersion: ruleVersion?.version,
            }
          )
        : null;

    const assessmentRef = generateReference("BEN");

    const assessment = await prisma.$transaction(async (tx) => {
      const a = await tx.benefitAssessment.create({
        data: {
          retirementCaseId: data.retirementCaseId,
          ruleVersionId: ruleVersionId,
          assessmentRef,
          status: "DRAFT",
          qualifyingServiceYears: qualifyingYears,
          finalSalary: finalSalary,
          calculationInputs: calc?.inputsSnapshot
            ? (calc.inputsSnapshot as object)
            : undefined,
          calculationBreakdown: calc?.breakdown
            ? (calc.breakdown as object)
            : undefined,
          grossEntitlement: calc?.grossEntitlement,
          deductions: calc?.deductions ?? 0,
          netEntitlement: calc?.netEntitlement,
          gratuityAmount: calc?.gratuityAmount,
          monthlyPension: calc?.monthlyPension,
          warnings: calc?.warnings?.join("\n") || null,
          assessedById: session.id,
          assessedAt: new Date(),
        },
        include: {
          retirementCase: {
            select: { caseReference: true },
          },
          ruleVersion: { select: { version: true, name: true } },
        },
      });

      await tx.retirementTimeline.create({
        data: {
          retirementCaseId: data.retirementCaseId,
          stage: rc.currentStage,
          action: "BENEFIT_ASSESSMENT_CREATED",
          performedById: session.id,
          comments: `Assessment ${assessmentRef} created`,
        },
      });

      return a;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "BENEFIT.CREATE",
      entityType: "BenefitAssessment",
      entityId: assessment.id,
      afterValues: {
        assessmentRef,
        retirementCaseId: data.retirementCaseId,
        monthlyPension: assessment.monthlyPension
          ? Number(assessment.monthlyPension)
          : null,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(assessment, 201);
  } catch (e) {
    console.error("Create benefit assessment error:", e);
    return jsonError("Failed to create benefit assessment", 500);
  }
}
