import { prisma } from "@/lib/database/prisma";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { toCsv } from "@/lib/reports/csv";
import { jsonUnauthorized, jsonError } from "@/lib/api/response";

/**
 * CSV export of the signed-in pensioner's payment history.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const pensioner = await getPensionerForUser(session);
  if (!pensioner) {
    return jsonError("No pensioner record linked to this account", 404);
  }

  const items = await prisma.paymentScheduleItem.findMany({
    where: { pensionerId: pensioner.id },
    include: {
      schedule: {
        select: {
          scheduleRef: true,
          paymentPeriod: true,
          status: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const headers = [
    "scheduleRef",
    "paymentPeriod",
    "periodStart",
    "periodEnd",
    "amount",
    "itemStatus",
    "scheduleStatus",
  ];
  const rows = items.map((i) => [
    i.schedule.scheduleRef,
    i.schedule.paymentPeriod,
    i.schedule.periodStart?.toISOString().slice(0, 10) ?? "",
    i.schedule.periodEnd?.toISOString().slice(0, 10) ?? "",
    i.amount?.toString() ?? "",
    i.status,
    i.schedule.status,
  ]);

  const csv = toCsv(headers, rows);
  const fileName = `payment-history-${pensioner.pensionerNumber}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
