import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  buildScheduleRef,
  parseScheduleCsv,
} from "@/lib/payments/parse-schedule-import";
import {
  assertNoDuplicatePaidMonthly,
  loadEligiblePensionerForMonthly,
} from "@/lib/payments/srs-enforcement";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ)
  ) {
    return jsonError("Forbidden", 403);
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const paymentPeriod = String(form.get("paymentPeriod") || "").trim();
    const notes = String(form.get("notes") || "").trim() || null;

    if (!paymentPeriod || !/^\d{4}-\d{2}$/.test(paymentPeriod)) {
      return jsonError("paymentPeriod is required as YYYY-MM", 400);
    }
    if (!file || !(file instanceof File)) {
      return jsonError("Excel/CSV file is required", 400);
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt") && !name.endsWith(".xlsx")) {
      return jsonError("Upload a .csv file (export Excel as CSV) or .xlsx", 400);
    }

    let text: string;
    if (name.endsWith(".xlsx")) {
      try {
        // Optional dependency — works when `xlsx` is installed
        const XLSX = await import("xlsx");
        const buf = Buffer.from(await file.arrayBuffer());
        const wb = XLSX.read(buf, { type: "buffer" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(sheet);
      } catch {
        return jsonError(
          "Excel (.xlsx) support requires the xlsx package. Run: npm install xlsx — or export the sheet as CSV and upload that.",
          400
        );
      }
    } else {
      text = await file.text();
    }

    const parsed = parseScheduleCsv(text);
    if (parsed.length === 0) {
      return jsonError("No data rows found in file", 400);
    }

    const numbers = [...new Set(parsed.map((r) => r.pensionerNumber))];
    const pensioners = await prisma.pensioner.findMany({
      where: { pensionerNumber: { in: numbers } },
      select: {
        id: true,
        pensionerNumber: true,
        bankName: true,
        bankAccountNumber: true,
        monthlyPension: true,
        paymentStatus: true,
        isActive: true,
        placementStatus: true,
      },
    });
    const byNumber = new Map(pensioners.map((p) => [p.pensionerNumber, p]));

    const valid: {
      pensionerId: string;
      amount: number;
      adjustments: number;
      deductions: number;
      netAmount: number;
      bankName: string | null;
      bankAccountNumber: string | null;
    }[] = [];
    const rowErrors: { row: number; pensionerNumber: string; error: string }[] =
      [];

    for (const row of parsed) {
      if (row.error) {
        rowErrors.push({
          row: row.rowNumber,
          pensionerNumber: row.pensionerNumber,
          error: row.error,
        });
        continue;
      }
      const p = byNumber.get(row.pensionerNumber);
      if (!p) {
        rowErrors.push({
          row: row.rowNumber,
          pensionerNumber: row.pensionerNumber,
          error: "Pensioner not found (BR-01)",
        });
        continue;
      }
      const elig = await loadEligiblePensionerForMonthly(row.pensionerNumber);
      if (!elig.ok) {
        rowErrors.push({
          row: row.rowNumber,
          pensionerNumber: row.pensionerNumber,
          error: elig.reason,
        });
        continue;
      }
      const dup = await assertNoDuplicatePaidMonthly(p.id, paymentPeriod);
      if (!dup.ok) {
        rowErrors.push({
          row: row.rowNumber,
          pensionerNumber: row.pensionerNumber,
          error: dup.reason,
        });
        continue;
      }
      const adjustments = row.adjustments ?? 0;
      const deductions = row.deductions ?? 0;
      const netAmount = row.amount + adjustments - deductions;
      if (netAmount <= 0) {
        rowErrors.push({
          row: row.rowNumber,
          pensionerNumber: row.pensionerNumber,
          error: "Net amount must be positive",
        });
        continue;
      }
      valid.push({
        pensionerId: p.id,
        amount: row.amount,
        adjustments,
        deductions,
        netAmount,
        bankName: row.bankName || p.bankName,
        bankAccountNumber: row.bankAccountNumber || p.bankAccountNumber,
      });
    }

    // Dedupe by pensioner — last row wins
    const deduped = new Map<string, (typeof valid)[0]>();
    for (const v of valid) deduped.set(v.pensionerId, v);
    const items = [...deduped.values()];

    if (items.length === 0) {
      return jsonError("No valid rows to import", 400, { rowErrors });
    }

    const [y, m] = paymentPeriod.split("-").map(Number);
    const periodStart = new Date(Date.UTC(y, m - 1, 1));
    const periodEnd = new Date(Date.UTC(y, m, 0));
    const totalAmount = items.reduce((s, i) => s + i.netAmount, 0);
    const scheduleRef = buildScheduleRef(paymentPeriod);

    const schedule = await prisma.$transaction(async (tx) => {
      const s = await tx.paymentSchedule.create({
        data: {
          scheduleRef,
          paymentPeriod,
          periodStart,
          periodEnd,
          status: "DRAFT",
          workflowStage: "PREPARATION",
          paymentType: "MONTHLY_PENSION",
          source: "IMPORT",
          importFileName: file.name,
          totalAmount: new Decimal(totalAmount),
          totalItems: items.length,
          preparedById: session.id,
          preparedAt: new Date(),
          notes,
          items: {
            create: items.map((i) => ({
              pensionerId: i.pensionerId,
              amount: new Decimal(i.amount),
              adjustments: new Decimal(i.adjustments),
              deductions: new Decimal(i.deductions),
              netAmount: new Decimal(i.netAmount),
              bankName: i.bankName,
              bankAccountNumber: i.bankAccountNumber,
              status: "PENDING",
            })),
          },
        },
        include: {
          items: {
            include: {
              pensioner: {
                select: { pensionerNumber: true, id: true },
              },
            },
          },
        },
      });
      return s;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PAYMENT_SCHEDULE.IMPORT",
      entityType: "PaymentSchedule",
      entityId: schedule.id,
      afterValues: {
        scheduleRef,
        paymentPeriod,
        totalItems: items.length,
        totalAmount,
        skipped: rowErrors.length,
        fileName: file.name,
      },
    });

    return jsonOk({
      schedule: {
        id: schedule.id,
        scheduleRef: schedule.scheduleRef,
        paymentPeriod: schedule.paymentPeriod,
        status: schedule.status,
        totalItems: schedule.totalItems,
        totalAmount: Number(schedule.totalAmount),
      },
      imported: items.length,
      skipped: rowErrors.length,
      rowErrors,
      reviewUrl: `/admin/payment-schedules/${schedule.id}/review`,
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Import failed", 500);
  }
}
