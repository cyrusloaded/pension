import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { retirementTransitionSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { createNotification } from "@/lib/notifications/create";
import {
  canTransition,
  getAllowedTransitions,
  stageLabel,
  type RetirementStage,
} from "@/lib/workflows/retirement";
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

  const { id } = await params;
  const existing = await prisma.retirementCase.findUnique({
    where: { id },
    include: {
      employee: {
        select: { firstName: true, lastName: true, staffNumber: true },
      },
      assignedOfficer: { select: { id: true } },
    },
  });
  if (!existing) return jsonNotFound("Retirement case not found");

  if (existing.status === "CLOSED" || existing.status === "REJECTED") {
    return jsonError("Case is closed and cannot be transitioned", 400);
  }

  try {
    const body = await req.json();
    const parsed = retirementTransitionSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { toStage, comments, reason } = parsed.data;
    const fromStage = existing.currentStage as RetirementStage;

    if (!canTransition(fromStage, toStage as RetirementStage)) {
      const allowed = getAllowedTransitions(fromStage);
      return jsonError(
        `Invalid transition from ${stageLabel(fromStage)} to ${stageLabel(toStage)}. Allowed: ${allowed.map(stageLabel).join(", ") || "none"}`,
        400
      );
    }

    // Permission checks by target stage group
    const needsReview =
      toStage === "CASE_REVIEW" ||
      toStage === "SERVICE_VERIFICATION" ||
      toStage === "DOCUMENT_SUBMISSION" ||
      toStage === "MISSING_INFO";
    const needsCalc =
      toStage === "BENEFIT_ASSESSMENT" || toStage === "CALCULATION_REVIEW";
    const needsApprove = toStage === "APPROVAL";
    const needsEnrol = toStage === "PENSIONER_ENROLMENT";
    const needsPayment =
      toStage === "PAYMENT_PREPARATION" ||
      toStage === "PAYMENT_AUTHORIZATION" ||
      toStage === "DISBURSEMENT";
    const isClosing = toStage === "CLOSED";

    if (isClosing) {
      if (
        !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW) &&
        !session.roles.includes("SUPER_ADMIN")
      ) {
        return jsonForbidden("Insufficient permission to close case");
      }
    } else if (needsApprove) {
      if (!hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)) {
        return jsonForbidden();
      }
    } else if (needsCalc) {
      if (
        !hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) &&
        !hasPermission(session, PERMISSIONS.BENEFITS_REVIEW)
      ) {
        return jsonForbidden();
      }
    } else if (needsEnrol) {
      if (!hasPermission(session, PERMISSIONS.PENSIONERS_CREATE)) {
        return jsonForbidden();
      }
    } else if (needsPayment) {
      if (
        !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
        !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
      ) {
        return jsonForbidden();
      }
    } else if (needsReview) {
      if (
        !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW) &&
        !hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)
      ) {
        return jsonForbidden();
      }
    } else {
      if (
        !hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) &&
        !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW)
      ) {
        return jsonForbidden();
      }
    }

    const newStatus =
      toStage === "CLOSED"
        ? reason?.toLowerCase().includes("reject")
          ? "REJECTED"
          : "CLOSED"
        : "OPEN";

    const updated = await prisma.$transaction(async (tx) => {
      const rc = await tx.retirementCase.update({
        where: { id },
        data: {
          currentStage: toStage as RetirementStage,
          status: newStatus,
          ...(toStage === "CLOSED" && !existing.actualRetirementDate
            ? { actualRetirementDate: new Date() }
            : {}),
        },
      });

      await tx.retirementTimeline.create({
        data: {
          retirementCaseId: id,
          stage: toStage,
          action: `TRANSITION_FROM_${fromStage}`,
          performedById: session.id,
          comments:
            comments ||
            reason ||
            `Moved from ${stageLabel(fromStage)} to ${stageLabel(toStage)}`,
        },
      });

      // Auto-enrol pensioner when reaching PENSIONER_ENROLMENT (basic record)
      if (toStage === "PENSIONER_ENROLMENT" && !existing.pensioner) {
        const approvedAssessment = await tx.benefitAssessment.findFirst({
          where: { retirementCaseId: id, status: "APPROVED" },
          orderBy: { approvedAt: "desc" },
        });

        const existingPensioner = await tx.pensioner.findFirst({
          where: { employeeId: existing.employeeId },
        });

        if (!existingPensioner) {
          const year = new Date().getFullYear();
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          await tx.pensioner.create({
            data: {
              pensionerNumber: `PEN-${year}-${random}`,
              employeeId: existing.employeeId,
              retirementCaseId: id,
              pensionSchemeId: existing.pensionSchemeId,
              retirementDate:
                existing.actualRetirementDate ||
                existing.expectedRetirementDate ||
                new Date(),
              enrolmentDate: new Date(),
              monthlyPension: approvedAssessment?.monthlyPension ?? null,
              entitlementAmount: approvedAssessment?.netEntitlement ?? null,
              paymentStatus: "PENDING",
              verificationStatus: "PENDING",
            },
          });

          await tx.employee.update({
            where: { id: existing.employeeId },
            data: { employmentStatus: "RETIRED" },
          });
        }
      }

      return rc;
    });

    // Notify assigned officer
    if (
      existing.assignedOfficerId &&
      existing.assignedOfficerId !== session.id
    ) {
      await createNotification({
        userId: existing.assignedOfficerId,
        title: `Case ${existing.caseReference} updated`,
        message: `Stage changed to ${stageLabel(toStage)} for ${existing.employee.lastName}, ${existing.employee.firstName}.`,
        type: "INFO",
        link: `/admin/retirements/${id}`,
      });
    }

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "RETIREMENT.TRANSITION",
      entityType: "RetirementCase",
      entityId: id,
      beforeValues: { stage: fromStage, status: existing.status },
      afterValues: { stage: toStage, status: newStatus },
      reason: comments || reason || undefined,
      outcome: "SUCCESS",
    });

    return jsonOk({
      id: updated.id,
      caseReference: updated.caseReference,
      currentStage: updated.currentStage,
      status: updated.status,
      allowedNext: getAllowedTransitions(toStage as RetirementStage),
    });
  } catch (e) {
    console.error("Transition error:", e);
    return jsonError("Failed to transition case", 500);
  }
}
