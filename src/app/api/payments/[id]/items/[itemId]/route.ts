import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { Decimal } from "@prisma/client/runtime/library";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function loadEditable(scheduleId: string, itemId: string) {
  const schedule = await prisma.paymentSchedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) return { error: jsonError("Schedule not found", 404) };
  if (!["DRAFT", "PENDING_REVIEW"].includes(schedule.status)) {
    return {
      error: jsonError(
        "Items can only be edited while schedule is DRAFT or PENDING_REVIEW",
        400
      ),
    };
  }
  const item = await prisma.paymentScheduleItem.findFirst({
    where: { id: itemId, scheduleId },
  });
  if (!item) return { error: jsonError("Line item not found", 404) };
  return { schedule, item };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
    return jsonError("Forbidden", 403);
  }

  const { id, itemId } = await ctx.params;
  const loaded = await loadEditable(id, itemId);
  if ("error" in loaded && loaded.error) return loaded.error;

  const body = await req.json();
  const amount = Number(body.amount);
  const adjustments = Number(body.adjustments ?? 0);
  const deductions = Number(body.deductions ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Valid amount is required", 400);
  }
  const netAmount = amount + adjustments - deductions;
  if (netAmount <= 0) return jsonError("Net amount must be positive", 400);

  const updated = await prisma.paymentScheduleItem.update({
    where: { id: itemId },
    data: {
      amount: new Decimal(amount),
      adjustments: new Decimal(adjustments),
      deductions: new Decimal(deductions),
      netAmount: new Decimal(netAmount),
      bankName: body.bankName !== undefined ? body.bankName : undefined,
      bankAccountNumber:
        body.bankAccountNumber !== undefined
          ? body.bankAccountNumber
          : undefined,
    },
  });

  // Recalc schedule totals
  const agg = await prisma.paymentScheduleItem.aggregate({
    where: { scheduleId: id },
    _sum: { netAmount: true },
    _count: true,
  });
  await prisma.paymentSchedule.update({
    where: { id },
    data: {
      totalAmount: agg._sum.netAmount ?? 0,
      totalItems: agg._count,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PAYMENT_SCHEDULE_ITEM.UPDATE",
    entityType: "PaymentScheduleItem",
    entityId: itemId,
    afterValues: { amount, adjustments, deductions, netAmount },
  });

  return jsonOk({ item: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
    return jsonError("Forbidden", 403);
  }

  const { id, itemId } = await ctx.params;
  const loaded = await loadEditable(id, itemId);
  if ("error" in loaded && loaded.error) return loaded.error;

  await prisma.paymentScheduleItem.delete({ where: { id: itemId } });

  const agg = await prisma.paymentScheduleItem.aggregate({
    where: { scheduleId: id },
    _sum: { netAmount: true },
    _count: true,
  });
  await prisma.paymentSchedule.update({
    where: { id },
    data: {
      totalAmount: agg._sum.netAmount ?? 0,
      totalItems: agg._count,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PAYMENT_SCHEDULE_ITEM.DELETE",
    entityType: "PaymentScheduleItem",
    entityId: itemId,
  });

  return jsonOk({ deleted: true });
}
