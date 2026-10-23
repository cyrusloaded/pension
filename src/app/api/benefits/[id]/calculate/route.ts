import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { benefitCalculateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  calculateBenefit,
  type RuleParams,
} from "@/lib/calculations/benefit-engine";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
} from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE)) {
    return jsonForbidden();
  }

  const { id } = await params;
  const existing = await prisma.benefitAssessment.findUnique({
    where: { id },
    include: { ruleVersion: true },
  });
  if (!existing) return jsonNotFound("Assessment not found");
  if (!["DRAFT", "RETURNED"].includes(existing.status)) {
    return jsonError(
      "Only DRAFT or RETURNED assessments can be recalculated",
      400
    );
  }

  try {
    const body = await req.json();
    const parsed = benefitCalculateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { qualifyingServiceYears, finalSalary, ruleVersionId } = parsed.data;

    let ruleVersion = existing.ruleVersion;
    if (ruleVersionId && ruleVersionId !== existing.ruleVersionId) {
      const rv = await prisma.pensionRuleVersion.findUnique({
        where: { id: ruleVersionId },
      });
      if (!rv || rv.status !== "APPROVED") {
        return jsonError("Rule version must exist and be APPROVED", 400);
      }
      ruleVersion = rv;
    }

    const rules = (ruleVersion?.rulesJson || {
      calculationMethod: "PLACEHOLDER",
      note: "No approved rule version.",
    }) as RuleParams;

    const calc = calculateBenefit(
      rules,
      { qualifyingServiceYears, finalSalary },
      {
        ruleVersionId: ruleVersion?.id,
        ruleVersion: ruleVersion?.version,
      }
    );

    const updated = await prisma.benefitAssessment.update({
      where: { id },
      data: {
        ruleVersionId: ruleVersion?.id || existing.ruleVersionId,
        qualifyingServiceYears,
        finalSalary,
        calculationInputs: calc.inputsSnapshot as object,
        calculationBreakdown: calc.breakdown as object,
        grossEntitlement: calc.grossEntitlement,
        deductions: calc.deductions,
        netEntitlement: calc.netEntitlement,
        gratuityAmount: calc.gratuityAmount,
        monthlyPension: calc.monthlyPension,
        warnings: calc.warnings.join("\n") || null,
        assessedById: session.id,
        assessedAt: new Date(),
        status: "DRAFT",
      },
      include: {
        ruleVersion: { select: { version: true, name: true, status: true } },
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "BENEFIT.CALCULATE",
      entityType: "BenefitAssessment",
      entityId: id,
      afterValues: {
        monthlyPension: calc.monthlyPension,
        gratuityAmount: calc.gratuityAmount,
        productionReady: calc.productionReady,
      },
      outcome: "SUCCESS",
    });

    return jsonOk({
      assessment: updated,
      calculation: calc,
    });
  } catch (e) {
    console.error(e);
    return jsonError("Calculation failed", 500);
  }
}
