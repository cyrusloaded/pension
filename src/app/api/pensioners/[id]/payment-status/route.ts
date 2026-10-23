import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { pensionerPaymentStatusSchema } from "@/lib/validation/schemas";
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

/**
 * Suspend, stop, or reactivate pensioner payments.
 * Requires a reason for audit.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE)
  ) {
    return jsonForbidden();
  }

  const { id } = await params;
  const existing = await prisma.pensioner.findUnique({
    where: { id },
    select: {
      id: true,
      pensionerNumber: true,
      paymentStatus: true,
      userId: true,
    },
  });
  if (!existing) return jsonNotFound("Pensioner not found");

  try {
    const body = await req.json();
    const parsed = pensionerPaymentStatusSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { paymentStatus, reason } = parsed.data;

    if (paymentStatus === existing.paymentStatus) {
      return jsonError(`Payment status is already ${paymentStatus}`, 400);
    }

    const updated = await prisma.pensioner.update({
      where: { id },
      data: { paymentStatus },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PENSIONER.PAYMENT_STATUS",
      entityType: "Pensioner",
      entityId: id,
      beforeValues: { paymentStatus: existing.paymentStatus },
      afterValues: { paymentStatus },
      reason,
      outcome: "SUCCESS",
    });

    if (existing.userId) {
      await createNotification({
        userId: existing.userId,
        title: `Payment status: ${paymentStatus}`,
        message: `Your pension payment status is now ${paymentStatus}. Reason: ${reason}`,
        type: paymentStatus === "ACTIVE" ? "SUCCESS" : "WARNING",
        link: "/portal/payments",
      });
    }

    return jsonOk({
      id: updated.id,
      pensionerNumber: updated.pensionerNumber,
      paymentStatus: updated.paymentStatus,
    });
  } catch (e) {
    console.error(e);
    return jsonError("Failed to update payment status", 500);
  }
}
