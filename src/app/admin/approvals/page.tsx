import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { stageLabel } from "@/lib/workflows/retirement";

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canSeeBenefits =
    hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) ||
    hasPermission(session, PERMISSIONS.BENEFITS_APPROVE);
  const canSeeRetirements = hasPermission(
    session,
    PERMISSIONS.RETIREMENTS_REVIEW
  );
  const canSeePayments =
    hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) ||
    hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE);
  const canSeeRules = hasPermission(session, PERMISSIONS.SETTINGS_MANAGE);

  if (!canSeeBenefits && !canSeeRetirements && !canSeePayments && !canSeeRules) {
    redirect("/unauthorized");
  }

  const [benefitAssessments, retirementCases, paymentSchedules, ruleVersions] =
    await Promise.all([
      canSeeBenefits
        ? prisma.benefitAssessment.findMany({
            where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
            include: {
              retirementCase: {
                select: {
                  id: true,
                  caseReference: true,
                  employee: {
                    select: {
                      staffNumber: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
      canSeeRetirements
        ? prisma.retirementCase.findMany({
            where: {
              status: "OPEN",
              currentStage: {
                in: ["CASE_REVIEW", "CALCULATION_REVIEW", "APPROVAL"],
              },
            },
            include: {
              employee: {
                select: { staffNumber: true, firstName: true, lastName: true },
              },
            },
            orderBy: { updatedAt: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
      canSeePayments
        ? prisma.paymentSchedule.findMany({
            where: { status: { in: ["PENDING_REVIEW", "APPROVED"] } },
            orderBy: { createdAt: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
      canSeeRules
        ? prisma.pensionRuleVersion.findMany({
            where: { status: "PENDING_APPROVAL" },
            include: { scheme: { select: { name: true, code: true } } },
            orderBy: { createdAt: "asc" },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

  const total =
    benefitAssessments.length +
    retirementCases.length +
    paymentSchedules.length +
    ruleVersions.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Approval Centre</h1>
        <p className="mt-1 text-sm text-slate-600">
          Items awaiting review or authorization · {total} in queue
        </p>
      </div>

      {total === 0 && (
        <div className="rounded-lg border border-border bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-card">
          No items pending your approval queues.
        </div>
      )}

      {canSeeBenefits && benefitAssessments.length > 0 && (
        <Queue title="Benefit assessments" count={benefitAssessments.length}>
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Reference</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Employee</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Monthly</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {benefitAssessments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-mono text-xs">{a.assessmentRef}</td>
                  <td className="px-4 py-2">
                    {a.retirementCase.employee.lastName}, {a.retirementCase.employee.firstName}
                    <span className="block text-xs text-slate-500">{a.retirementCase.caseReference}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {a.monthlyPension != null ? formatCurrency(Number(a.monthlyPension)) : "—"}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/benefits/${a.id}`} className="font-medium text-primary hover:underline">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Queue>
      )}

      {canSeeRetirements && retirementCases.length > 0 && (
        <Queue title="Retirement cases" count={retirementCases.length}>
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Case</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Employee</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Stage</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {retirementCases.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-mono text-xs">{c.caseReference}</td>
                  <td className="px-4 py-2">
                    {c.employee.lastName}, {c.employee.firstName}
                    <span className="block text-xs text-slate-500">{c.employee.staffNumber}</span>
                  </td>
                  <td className="px-4 py-2">{stageLabel(c.currentStage)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/retirements/${c.id}`} className="font-medium text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Queue>
      )}

      {canSeePayments && paymentSchedules.length > 0 && (
        <Queue title="Payment schedules" count={paymentSchedules.length}>
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Schedule</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Period</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Total</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paymentSchedules.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono text-xs">{s.scheduleRef}</td>
                  <td className="px-4 py-2">{s.paymentPeriod}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(Number(s.totalAmount))}</td>
                  <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/payment-schedules`} className="font-medium text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Queue>
      )}

      {canSeeRules && ruleVersions.length > 0 && (
        <Queue title="Pension rule versions" count={ruleVersions.length}>
          <ul className="divide-y divide-border text-sm">
            {ruleVersions.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <span>
                  {r.scheme.name} · v{r.version} — {r.name}
                </span>
                <Link href="/admin/pension-rules" className="font-medium text-primary hover:underline">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </Queue>
      )}
    </div>
  );
}

function Queue({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {count}
        </span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
