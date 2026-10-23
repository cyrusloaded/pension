import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getAllowedPaymentTransitions,
  type PaymentStatus,
} from "@/lib/workflows/payments";
import { ScheduleTransitionForm } from "./ScheduleTransitionForm";
import { GovWorkflowPanel } from "@/components/payments/GovWorkflowPanel";

export default async function PaymentScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const schedule = await prisma.paymentSchedule.findUnique({
    where: { id },
    include: {
      reconciliation: true,
      _count: { select: { items: true } },
    },
  });
  if (!schedule) notFound();

  const items = await prisma.paymentScheduleItem.findMany({
    where: { scheduleId: id },
    include: {
      pensioner: {
        select: {
          pensionerNumber: true,
          bankAccountName: true,
          employee: {
            select: { firstName: true, lastName: true, staffNumber: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const allowed = getAllowedPaymentTransitions(schedule.status as PaymentStatus);
  const canAct =
    hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) ||
    hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) ||
    hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/payment-schedules"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Payment schedules
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {schedule.scheduleRef}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">Period {schedule.paymentPeriod}</span>
          <StatusBadge status={schedule.status} />
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total amount" value={formatCurrency(Number(schedule.totalAmount))} />
        <Card label="Items" value={String(schedule.totalItems)} />
        <Card label="Prepared" value={formatDateTime(schedule.preparedAt)} />
        <Card
          label="Authorized"
          value={schedule.authorizedAt ? formatDateTime(schedule.authorizedAt) : "—"}
        />
      </div>

      {schedule.notes && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {schedule.notes}
        </div>
      )}

      {allowed.length > 0 && canAct && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Advance schedule
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Dual control applies: the preparer cannot approve or authorize their
            own schedule. All transitions are enforced server-side.
          </p>
          <GovWorkflowPanel
            scheduleId={schedule.id}
            workflowStage={schedule.workflowStage || "PREPARATION"}
          />
          <ScheduleTransitionForm scheduleId={schedule.id} allowed={allowed} />
        </section>
      )}

      {schedule.reconciliation && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Reconciliation
          </h2>
          <p className="text-sm">
            {schedule.reconciliation.reference} ·{" "}
            <StatusBadge status={schedule.reconciliation.status} />
            {schedule.reconciliation.variance != null && (
              <span className="ml-2 text-slate-600">
                Variance: {formatCurrency(Number(schedule.reconciliation.variance))}
              </span>
            )}
          </p>
          <Link
            href="/admin/reconciliation"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            View reconciliations
          </Link>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Payment items (showing {items.length} of {schedule.totalItems})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Pensioner</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Bank</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Net</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{item.pensioner.pensionerNumber}</span>
                    <span className="block text-slate-600">
                      {item.pensioner.employee
                        ? `${item.pensioner.employee.lastName}, ${item.pensioner.employee.firstName}`
                        : item.pensioner.bankAccountName || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {item.bankName || "—"}
                    {item.bankAccountNumber && (
                      <span className="block font-mono text-xs">
                        ****{item.bankAccountNumber.slice(-4)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(Number(item.amount))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(Number(item.netAmount))}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
