import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { reconciliationCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateReference } from "@/lib/utils";
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
    !hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ)
  ) {
    return jsonForbidden();
  }

  const items = await prisma.paymentReconciliation.findMany({
    include: {
      schedule: {
        select: {
          scheduleRef: true,
          paymentPeriod: true,
          totalAmount: true,
          totalItems: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = reconciliationCreateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;
    const schedule = await prisma.paymentSchedule.findUnique({
      where: { id: data.scheduleId },
      include: {
        reconciliation: true,
        _count: { select: { items: true } },
      },
    });
    if (!schedule) return jsonError("Schedule not found", 400);
    if (schedule.reconciliation) {
      return jsonError("Schedule already has a reconciliation record", 409);
    }
    if (!["SUCCESSFUL", "PROCESSING", "SUBMITTED"].includes(schedule.status)) {
      return jsonError(
        "Reconciliation is only allowed after the schedule has been submitted or completed",
        400
      );
    }

    const expected = Number(schedule.totalAmount);
    const actual = data.actualAmount ?? expected;
    const variance = actual - expected;
    const matched = data.matchedItems ?? schedule.totalItems;
    const unmatched = data.unmatchedItems ?? 0;

    let status = "MATCHED";
    if (Math.abs(variance) > 0.01 || unmatched > 0) {
      status = "VARIANCE";
    }

    const reference = generateReference("REC");

    const rec = await prisma.$transaction(async (tx) => {
      const r = await tx.paymentReconciliation.create({
        data: {
          reference,
          scheduleId: data.scheduleId,
          bankReference: data.bankReference || null,
          bankDate: data.bankDate ? new Date(data.bankDate) : null,
          expectedAmount: expected,
          actualAmount: actual,
          variance,
          matchedItems: matched,
          unmatchedItems: unmatched,
          status,
          notes: data.notes || null,
          reconciledById: session.id,
          reconciledAt: new Date(),
        },
        include: {
          schedule: {
            select: { scheduleRef: true, paymentPeriod: true },
          },
        },
      });

      if (status === "MATCHED") {
        await tx.paymentSchedule.update({
          where: { id: data.scheduleId },
          data: { status: "RECONCILED" },
        });
      }

      return r;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PAYMENT.RECONCILE",
      entityType: "PaymentReconciliation",
      entityId: rec.id,
      afterValues: {
        scheduleId: data.scheduleId,
        expected,
        actual,
        variance,
        status,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(rec, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Reconciliation failed", 500);
  }
}
