import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_READ)) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const schedule = await prisma.paymentSchedule.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          pensioner: {
            select: {
              pensionerNumber: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      assessment: true,
    },
  });
  if (!schedule) return jsonError("Not found", 404);
  return jsonOk({ schedule });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const schedule = await prisma.paymentSchedule.findUnique({
    where: { id },
    include: { assessment: true },
  });
  if (!schedule) return jsonError("Not found", 404);
  if (schedule.assessment?.status === "PAID") {
    return jsonError("Cannot delete a schedule that has been paid", 400);
  }
  if (["SUCCESSFUL", "RECONCILED"].includes(schedule.status)) {
    return jsonError(`Cannot delete schedule in status ${schedule.status}`, 400);
  }

  await prisma.paymentSchedule.delete({ where: { id } });
  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PAYMENT_SCHEDULE.DELETE",
    entityType: "PaymentSchedule",
    entityId: id,
    beforeValues: { scheduleRef: schedule.scheduleRef },
  });
  return jsonOk({ deleted: true });
}
