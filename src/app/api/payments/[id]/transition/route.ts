import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { paymentTransitionSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { createNotification } from "@/lib/notifications/create";
import {
  canTransitionPayment,
  getAllowedPaymentTransitions,
  type PaymentStatus,
} from "@/lib/workflows/payments";
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
  const existing = await prisma.paymentSchedule.findUnique({ where: { id } });
  if (!existing) return jsonNotFound("Schedule not found");

  try {
    const body = await req.json();
    const parsed = paymentTransitionSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const toStatus = parsed.data.toStatus as PaymentStatus;
    const fromStatus = existing.status as PaymentStatus;

    if (!canTransitionPayment(fromStatus, toStatus)) {
      const allowed = getAllowedPaymentTransitions(fromStatus);
      return jsonError(
        `Invalid transition from ${fromStatus} to ${toStatus}. Allowed: ${allowed.join(", ") || "none"}`,
        400
      );
    }

    // Permission by target
    if (toStatus === "PENDING_REVIEW" || toStatus === "DRAFT") {
      if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
        return jsonForbidden();
      }
    } else if (toStatus === "APPROVED") {
      if (
        !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) &&
        !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)
      ) {
        return jsonForbidden();
      }
      // Separation of duties: preparer cannot approve
      if (
        existing.preparedById === session.id &&
        !session.roles.includes("SUPER_ADMIN")
      ) {
        return jsonForbidden(
          "You cannot approve a schedule you prepared (separation of duties)"
        );
      }
    } else if (toStatus === "AUTHORIZED" || toStatus === "SUBMITTED") {
      if (!hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)) {
        return jsonForbidden();
      }
      if (
        existing.preparedById === session.id &&
        !session.roles.includes("SUPER_ADMIN") &&
        toStatus === "AUTHORIZED"
      ) {
        return jsonForbidden(
          "You cannot authorize a schedule you prepared (separation of duties)"
        );
      }
    } else if (
      toStatus === "PROCESSING" ||
      toStatus === "SUCCESSFUL" ||
      toStatus === "FAILED"
    ) {
      if (
        !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) &&
        !hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE)
      ) {
        return jsonForbidden();
      }
    } else if (toStatus === "RECONCILED") {
      if (!hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE)) {
        return jsonForbidden();
      }
    } else if (toStatus === "CANCELLED") {
      if (
        !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
        !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
      ) {
        return jsonForbidden();
      }
    }

    const updateData: Record<string, unknown> = {
      status: toStatus,
      notes: parsed.data.notes || existing.notes,
    };
    if (toStatus === "APPROVED") {
      updateData.approvedById = session.id;
      updateData.approvedAt = new Date();
    }
    if (toStatus === "AUTHORIZED") {
      updateData.authorizedById = session.id;
      updateData.authorizedAt = new Date();
    }
    if (toStatus === "SUBMITTED") {
      updateData.submittedAt = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.paymentSchedule.update({
        where: { id },
        data: updateData,
      });

      // When successful, mark items successful if still pending
      if (toStatus === "SUCCESSFUL") {
        await tx.paymentScheduleItem.updateMany({
          where: { scheduleId: id, status: "PENDING" },
          data: { status: "SUCCESSFUL" },
        });
      }
      if (toStatus === "FAILED") {
        await tx.paymentScheduleItem.updateMany({
          where: { scheduleId: id, status: { in: ["PENDING", "PROCESSING"] } },
          data: { status: "FAILED" },
        });
      }

      return s;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PAYMENT.TRANSITION",
      entityType: "PaymentSchedule",
      entityId: id,
      beforeValues: { status: fromStatus },
      afterValues: { status: toStatus },
      reason: parsed.data.notes || undefined,
      outcome: "SUCCESS",
    });

    return jsonOk({
      id: updated.id,
      scheduleRef: updated.scheduleRef,
      status: updated.status,
      allowedNext: getAllowedPaymentTransitions(toStatus),
    });
  } catch (e) {
    console.error(e);
    return jsonError("Transition failed", 500);
  }
}
