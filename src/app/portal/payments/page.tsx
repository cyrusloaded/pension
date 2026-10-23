import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { prisma } from "@/lib/database/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DownloadButton } from "@/components/ui/DownloadButton";

export default async function PortalPaymentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pensioner = await getPensionerForUser(session);
  if (!pensioner) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        No pensioner record linked.
      </div>
    );
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
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment history</h1>
          <p className="mt-1 text-sm text-slate-600">
            Monthly pension payments recorded for {pensioner.pensionerNumber}
          </p>
        </div>
        {items.length > 0 && (
          <DownloadButton
            href="/api/portal/payments/export"
            label="Download CSV"
            fileName={`payment-history-${pensioner.pensionerNumber}.csv`}
            variant="primary"
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase text-slate-500">Payment status</p>
          <div className="mt-1">
            <StatusBadge status={pensioner.paymentStatus} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase text-slate-500">Monthly pension</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {pensioner.monthlyPension != null
              ? formatCurrency(Number(pensioner.monthlyPension))
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase text-slate-500">Frequency</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {pensioner.paymentFrequency}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {items.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No payment records yet. Once a monthly schedule includes your account,
            payments will appear here.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Period</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Schedule</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Net paid</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.schedule.paymentPeriod}</td>
                  <td className="px-4 py-3 font-mono text-xs">{item.schedule.scheduleRef}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(Number(item.amount))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatCurrency(Number(item.netAmount))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(item.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
