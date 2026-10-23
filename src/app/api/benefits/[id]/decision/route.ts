import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { benefitDecisionSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { createNotification } from "@/lib/notifications/create";
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
  const existing = await prisma.benefitAssessment.findUnique({
    where: { id },
    include: {
      retirementCase: {
        select: {
          id: true,
          caseReference: true,
          assignedOfficerId: true,
          currentStage: true,
        },
      },
    },
  });
  if (!existing) return jsonNotFound("Assessment not found");

  try {
    const body = await req.json();
    const parsed = benefitDecisionSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { action, comments } = parsed.data;

    // Separation of duties: cannot approve own assessment
    if (
      action === "APPROVE" &&
      existing.assessedById &&
      existing.assessedById === session.id &&
      !session.roles.includes("SUPER_ADMIN")
    ) {
      return jsonForbidden(
        "You cannot approve an assessment you created (separation of duties)"
      );
    }

    let newStatus = existing.status;
    const updateData: Record<string, unknown> = {
      reviewerComments: comments || existing.reviewerComments,
    };

    switch (action) {
      case "SUBMIT":
        if (!hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE)) {
          return jsonForbidden();
        }
        if (!["DRAFT", "RETURNED"].includes(existing.status)) {
          return jsonError("Only DRAFT or RETURNED assessments can be submitted", 400);
        }
        if (
          existing.monthlyPension == null &&
          existing.gratuityAmount == null &&
          existing.netEntitlement == null
        ) {
          // Allow submit of placeholder for review, but flag
          // still ok to submit for policy review
        }
        newStatus = "SUBMITTED";
        updateData.status = newStatus;
        break;

      case "RETURN":
        if (
          !hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) &&
          !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)
        ) {
          return jsonForbidden();
        }
        if (!["SUBMITTED", "UNDER_REVIEW"].includes(existing.status)) {
          return jsonError("Only submitted assessments can be returned", 400);
        }
        newStatus = "RETURNED";
        updateData.status = newStatus;
        updateData.reviewedById = session.id;
        updateData.reviewedAt = new Date();
        break;

      case "APPROVE":
        if (!hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)) {
          return jsonForbidden();
        }
        if (!["SUBMITTED", "UNDER_REVIEW"].includes(existing.status)) {
          return jsonError("Only submitted assessments can be approved", 400);
        }
        newStatus = "APPROVED";
        updateData.status = newStatus;
        updateData.approvedById = session.id;
        updateData.approvedAt = new Date();
        updateData.reviewedById = session.id;
        updateData.reviewedAt = new Date();
        break;

      case "REJECT":
        if (
          !hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) &&
          !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)
        ) {
          return jsonForbidden();
        }
        if (!["SUBMITTED", "UNDER_REVIEW", "DRAFT"].includes(existing.status)) {
          return jsonError("Invalid status for rejection", 400);
        }
        newStatus = "REJECTED";
        updateData.status = newStatus;
        updateData.reviewedById = session.id;
        updateData.reviewedAt = new Date();
        break;

      default:
        return jsonError("Unknown action", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.benefitAssessment.update({
        where: { id },
        data: updateData,
      });

      await tx.retirementTimeline.create({
        data: {
          retirementCaseId: existing.retirementCaseId,
          stage: existing.retirementCase.currentStage,
          action: `BENEFIT_${action}`,
          performedById: session.id,
          comments:
            comments ||
            `${action} on assessment ${existing.assessmentRef}`,
        },
      });

      return a;
    });

    if (
      existing.retirementCase.assignedOfficerId &&
      existing.retirementCase.assignedOfficerId !== session.id
    ) {
      await createNotification({
        userId: existing.retirementCase.assignedOfficerId,
        title: `Benefit assessment ${action.toLowerCase()}`,
        message: `Assessment ${existing.assessmentRef} on case ${existing.retirementCase.caseReference} was ${action.toLowerCase()}.`,
        type: action === "APPROVE" ? "SUCCESS" : "INFO",
        link: `/admin/benefits/${id}`,
      });
    }

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: `BENEFIT.${action}`,
      entityType: "BenefitAssessment",
      entityId: id,
      beforeValues: { status: existing.status },
      afterValues: { status: newStatus },
      reason: comments || undefined,
      outcome: "SUCCESS",
    });

    return jsonOk(updated);
  } catch (e) {
    console.error(e);
    return jsonError("Decision failed", 500);
  }
}
