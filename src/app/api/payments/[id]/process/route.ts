import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";

type Ctx = { params: Promise<{ id: string }> };

/** Mark schedule ready for assessment generation (Process). */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await ctx.params;
  const schedule = await prisma.paymentSchedule.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!schedule) return jsonError("Schedule not found", 404);
  if (!["DRAFT", "PENDING_REVIEW"].includes(schedule.status)) {
    return jsonError(
      `Cannot process schedule in status ${schedule.status}`,
      400
    );
  }
  if (schedule._count.items === 0) {
    return jsonError("Schedule has no line items", 400);
  }

  const updated = await prisma.paymentSchedule.update({
    where: { id },
    data: {
      status: "PENDING_REVIEW",
      workflowStage: schedule.workflowStage === "PREPARATION" ? "INTERNAL_AUDIT" : schedule.workflowStage,
      notes: schedule.notes
        ? `${schedule.notes}\nProcessed for assessment ${new Date().toISOString()}`
        : `Processed for assessment ${new Date().toISOString()}`,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PAYMENT_SCHEDULE.PROCESS",
    entityType: "PaymentSchedule",
    entityId: id,
    afterValues: { status: updated.status },
  });

  return jsonOk({
    schedule: updated,
    processUrl: `/admin/payment-schedules/${id}/process`,
  });
}
