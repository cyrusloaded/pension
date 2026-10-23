import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PrepareScheduleForm } from "./PrepareScheduleForm";

interface SearchParams {
  status?: string;
  page?: string;
  pageSize?: string;
}

export default async function PaymentSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
  ) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const status = params.status;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || "25", 10)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [schedules, total] = await Promise.all([
    prisma.paymentSchedule.findMany({
      where,
      include: {
        reconciliation: { select: { status: true } },
      },
      orderBy: { paymentPeriod: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentSchedule.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const canPrepare = hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment Schedules</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monthly pension payroll preparation and authorization · {total.toLocaleString()} schedules
        </p>
      </div>

      
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          href="/admin/payment-schedules/import"
          className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Import from Excel / CSV
        </Link>
        <span className="self-center text-sm text-slate-500">
          Or prepare a single schedule from active pensioners below.
        </span>
      </div>

      {canPrepare && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Prepare monthly schedule
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Builds a DRAFT schedule from all ACTIVE pensioners with monthly
            pension and bank details. Requires dual control before disbursement.
          </p>
          <PrepareScheduleForm />
        </div>
      )}

      <form className="flex flex-wrap gap-3" method="get">
        <select name="status" defaultValue={status || ""} className="rounded-md border border-border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="APPROVED">Approved</option>
          <option value="AUTHORIZED">Authorized</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="PROCESSING">Processing</option>
          <option value="SUCCESSFUL">Successful</option>
          <option value="FAILED">Failed</option>
          <option value="RECONCILED">Reconciled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button type="submit" className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {schedules.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No payment schedules yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Period</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reconciled</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Prepared</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">
                      <Link href={`/admin/payment-schedules/${s.id}/review`} className="text-primary hover:underline">
                        {s.scheduleRef}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.paymentPeriod}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.totalItems}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(Number(s.totalAmount))}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      {s.reconciliation ? (
                        <StatusBadge status={s.reconciliation.status} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(s.preparedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/payment-schedules/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/admin/payment-schedules?page=${page - 1}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/admin/payment-schedules?page=${page + 1}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
