import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { paymentScheduleCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { isEligibleForMonthlyPension } from "@/lib/payments/business-rules";
import { generateReference } from "@/lib/utils";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

function periodBounds(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return { start, end };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
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
    prisma.paymentSchedule.findMany({
      where,
      include: {
        _count: { select: { items: true } },
        reconciliation: { select: { id: true, status: true } },
      },
      orderBy: { paymentPeriod: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentSchedule.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

/**
 * Prepare a monthly payment schedule from all ACTIVE pensioners
 * with a defined monthly pension and bank details.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = paymentScheduleCreateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { paymentPeriod, notes } = parsed.data;

    const existing = await prisma.paymentSchedule.findFirst({
      where: {
        paymentPeriod,
        status: { notIn: ["CANCELLED"] },
      },
    });
    if (existing) {
      return jsonError(
        `A schedule already exists for ${paymentPeriod} (${existing.scheduleRef}, status ${existing.status})`,
        409
      );
    }

    const pensioners = await prisma.pensioner.findMany({
      where: {
        isActive: true,
        paymentStatus: "ACTIVE",
        monthlyPension: { not: null },
      },
      select: {
        id: true,
        pensionerNumber: true,
        monthlyPension: true,
        bankName: true,
        bankAccountNumber: true,
        paymentStatus: true,
        isActive: true,
        placementStatus: true,
      },
    });

    if (pensioners.length === 0) {
      return jsonError(
        "No ACTIVE pensioners with monthly pension found. Activate pensioners before preparing a schedule.",
        400
      );
    }

    const missingBank = pensioners.filter((p) => !p.bankAccountNumber);
    // Include them but mark item status PENDING with note via failureReason later if needed
    // For safety, exclude those without bank accounts from the schedule
    const payable = pensioners.filter(
      (p) =>
        p.bankAccountNumber &&
        p.monthlyPension &&
        isEligibleForMonthlyPension({
          isActive: p.isActive,
          paymentStatus: p.paymentStatus,
          placementStatus: (p as { placementStatus?: string }).placementStatus,
        })
    );
    if (payable.length === 0) {
      return jsonError(
        "No ACTIVE pensioners have both monthly pension and bank account details.",
        400
      );
    }

    const { start, end } = periodBounds(paymentPeriod);
    let totalAmount = 0;
    for (const p of payable) {
      totalAmount += Number(p.monthlyPension);
    }

    const scheduleRef = generateReference("PAY");

    const schedule = await prisma.$transaction(async (tx) => {
      const s = await tx.paymentSchedule.create({
        data: {
          scheduleRef,
          paymentPeriod,
          periodStart: start,
          periodEnd: end,
          status: "DRAFT",
          workflowStage: "PREPARATION",
          paymentType: "MONTHLY_PENSION",
          totalAmount,
          totalItems: payable.length,
          preparedById: session.id,
          preparedAt: new Date(),
          notes:
            notes ||
            (missingBank.length
              ? `Excluded ${missingBank.length} pensioner(s) without bank details.`
              : null),
        },
      });

      // Batch create items
      const chunk = 100;
      for (let i = 0; i < payable.length; i += chunk) {
        const slice = payable.slice(i, i + chunk);
        await tx.paymentScheduleItem.createMany({
          data: slice.map((p) => {
            const amount = Number(p.monthlyPension);
            return {
              scheduleId: s.id,
              pensionerId: p.id,
              amount,
              adjustments: null,
              deductions: null,
              netAmount: amount,
              bankAccountNumber: p.bankAccountNumber,
              bankName: p.bankName,
              status: "PENDING",
            };
          }),
        });
      }

      return s;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PAYMENT.SCHEDULE_CREATE",
      entityType: "PaymentSchedule",
      entityId: schedule.id,
      afterValues: {
        scheduleRef,
        paymentPeriod,
        totalItems: payable.length,
        totalAmount,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(
      {
        ...schedule,
        excludedWithoutBank: missingBank.length,
      },
      201
    );
  } catch (e) {
    console.error("Create payment schedule error:", e);
    return jsonError("Failed to prepare payment schedule", 500);
  }
}
