import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PayAssessmentPanel } from "@/components/payments/PayAssessmentPanel";

export default async function PaymentAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const assessment = await prisma.paymentAssessment.findUnique({
    where: { id },
    include: {
      schedule: {
        include: {
          items: {
            include: {
              pensioner: { select: { pensionerNumber: true } },
            },
            take: 100,
          },
        },
      },
      transactions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!assessment) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/payment-schedules" className="text-sm text-primary hover:underline">
          ← Payment schedules
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Payment assessment
        </h1>
        <p className="font-mono text-sm text-slate-600">{assessment.assessmentCode}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Status</p>
          <StatusBadge status={assessment.status} />
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="text-lg font-semibold">
            {formatCurrency(Number(assessment.totalAmount))}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Period</p>
          <p className="font-medium">{assessment.paymentPeriod}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Schedule</p>
          <Link
            href={`/admin/payment-schedules/${assessment.scheduleId}/review`}
            className="font-medium text-primary hover:underline"
          >
            {assessment.schedule.scheduleRef}
          </Link>
        </div>
      </div>

      {assessment.status === "PAID" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Payment recorded on the system</p>
          <p>
            Method: {assessment.paymentMethod} · Gateway:{" "}
            {assessment.gatewayProvider || "—"} · Ref:{" "}
            {assessment.gatewayRef || "—"}
          </p>
          <p>
            Paid at:{" "}
            {assessment.paidAt ? formatDate(assessment.paidAt) : "—"} · Receipt:{" "}
            {assessment.receiptRef || "—"}
          </p>
        </div>
      )}

      <PayAssessmentPanel
        assessmentId={assessment.id}
        assessmentCode={assessment.assessmentCode}
        totalAmount={Number(assessment.totalAmount)}
        status={assessment.status}
        currency={assessment.currency}
      />

      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold">Tied schedule lines (sample)</h2>
        <ul className="mt-2 text-sm text-slate-600">
          {assessment.schedule.items.map((i) => (
            <li key={i.id} className="flex justify-between border-b py-1">
              <span>{i.pensioner.pensionerNumber}</span>
              <span>{formatCurrency(Number(i.netAmount))}</span>
            </li>
          ))}
        </ul>
      </div>

      {assessment.transactions.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold">Gateway transactions</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {assessment.transactions.map((t) => (
              <li key={t.id} className="flex justify-between border-b py-1">
                <span>
                  {t.provider} · {t.externalRef} · {t.status}
                </span>
                <span>{formatCurrency(Number(t.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
