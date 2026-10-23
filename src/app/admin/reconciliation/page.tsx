import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CreateReconciliationForm } from "./CreateReconciliationForm";

export default async function ReconciliationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ)
  ) {
    redirect("/unauthorized");
  }

  const [recs, schedules] = await Promise.all([
    prisma.paymentReconciliation.findMany({
      include: {
        schedule: {
          select: {
            id: true,
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
    }),
    prisma.paymentSchedule.findMany({
      where: {
        status: { in: ["SUCCESSFUL", "PROCESSING", "SUBMITTED"] },
        reconciliation: null,
      },
      select: {
        id: true,
        scheduleRef: true,
        paymentPeriod: true,
        totalAmount: true,
        totalItems: true,
      },
      orderBy: { paymentPeriod: "desc" },
      take: 30,
    }),
  ]);

  const canReconcile = hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reconciliation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Match bank returns against authorized payment schedules
        </p>
      </div>

      {canReconcile && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Record reconciliation
          </h2>
          <CreateReconciliationForm schedules={schedules} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {recs.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No reconciliation records yet.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Schedule</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Expected</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actual</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Variance</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/payment-schedules/${r.schedule.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.schedule.scheduleRef}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {r.schedule.paymentPeriod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(Number(r.expectedAmount))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.actualAmount != null
                      ? formatCurrency(Number(r.actualAmount))
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.variance != null ? formatCurrency(Number(r.variance)) : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatDate(r.reconciledAt)}
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
