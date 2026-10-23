import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  UserCog,
  FileText,
  CreditCard,
  ClipboardCheck,
  MessageSquare,
  LayoutDashboard,
  Download,
} from "lucide-react";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  employeeHeadcountReport,
  pensionerReport,
  retirementPipelineReport,
  paymentsFinancialReport,
  verificationReport,
  complaintsReport,
  systemOverviewReport,
} from "@/lib/reports/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { stageLabel } from "@/lib/workflows/retirement";

const REPORTS = [
  { type: "overview", label: "System overview", icon: LayoutDashboard, desc: "Key operational counts" },
  { type: "employees", label: "Employee headcount", icon: Users, desc: "By status and organization" },
  { type: "pensioners", label: "Pensioners", icon: UserCog, desc: "Payroll and verification status" },
  { type: "retirements", label: "Retirement pipeline", icon: FileText, desc: "Open cases by stage" },
  { type: "payments", label: "Payments & finance", icon: CreditCard, desc: "Schedules, arrears, benefits" },
  { type: "verification", label: "Verification queue", icon: ClipboardCheck, desc: "Pending verifications" },
  { type: "complaints", label: "Complaints", icon: MessageSquare, desc: "Open service complaints" },
] as const;

interface SearchParams {
  type?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canView =
    hasPermission(session, PERMISSIONS.REPORTS_VIEW) ||
    session.roles.includes("SUPER_ADMIN") ||
    hasPermission(session, PERMISSIONS.EMPLOYEES_READ) ||
    hasPermission(session, PERMISSIONS.PAYMENTS_READ) ||
    hasPermission(session, PERMISSIONS.AUDIT_READ);

  if (!canView) redirect("/unauthorized");

  const canExport =
    hasPermission(session, PERMISSIONS.REPORTS_EXPORT) ||
    session.roles.includes("SUPER_ADMIN");

  const params = await searchParams;
  const type = params.type || "overview";

  let content: React.ReactNode = null;

  if (type === "overview") {
    const data = await systemOverviewReport();
    content = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {k.replace(/([A-Z])/g, " $1").trim()}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{Number(v).toLocaleString()}</p>
          </div>
        ))}
      </div>
    );
  } else if (type === "employees") {
    const data = await employeeHeadcountReport();
    content = (
      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Active employees: <strong>{data.total}</strong> · Archived: {data.archived}
        </p>
        <TwoCol
          leftTitle="By employment status"
          left={data.byStatus.map((r) => ({ label: r.status, value: r.count }))}
          rightTitle="By organization"
          right={data.byOrganization.map((r) => ({
            label: r.name,
            value: r.count,
          }))}
        />
      </div>
    );
  } else if (type === "pensioners") {
    const data = await pensionerReport();
    content = (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Total pensioners" value={String(data.total)} />
          <Metric label="Active on payroll" value={String(data.activeOnPayroll)} />
          <Metric
            label="Monthly payroll total"
            value={formatCurrency(data.monthlyPayroll.totalMonthly)}
          />
        </div>
        <TwoCol
          leftTitle="Payment status"
          left={data.byPaymentStatus.map((r) => ({ label: r.status, value: r.count }))}
          rightTitle="Verification status"
          right={data.byVerification.map((r) => ({ label: r.status, value: r.count }))}
        />
      </div>
    );
  } else if (type === "retirements") {
    const data = await retirementPipelineReport();
    content = (
      <div className="space-y-6">
        <p className="text-sm text-slate-600">
          Open cases: <strong>{data.totalOpen}</strong>
        </p>
        <TwoCol
          leftTitle="By stage (open)"
          left={data.byStage.map((r) => ({
            label: stageLabel(r.stage),
            value: r.count,
          }))}
          rightTitle="By status"
          right={data.byStatus.map((r) => ({ label: r.status, value: r.count }))}
        />
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Recent open cases
          </div>
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">Case</th>
                <th className="px-4 py-2 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Organization</th>
                <th className="px-4 py-2 text-left">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recentCases.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <Link href={`/admin/retirements/${c.id}`} className="font-mono text-xs text-primary hover:underline">
                      {c.caseReference}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {c.name}
                    <span className="block text-xs text-slate-500">{c.staffNumber}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.organization}</td>
                  <td className="px-4 py-2">{stageLabel(c.stage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (type === "payments") {
    const data = await paymentsFinancialReport();
    content = (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric
            label="Open arrears amount"
            value={formatCurrency(data.arrears.openAmount)}
          />
          <Metric label="Open arrears count" value={String(data.arrears.openCount)} />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Recent payment schedules
          </div>
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">Period</th>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-right">Items</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Recon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.schedules.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium">{s.paymentPeriod}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/payment-schedules/${s.id}`} className="font-mono text-xs text-primary hover:underline">
                      {s.scheduleRef}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.totalItems}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(s.totalAmount)}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2">
                    {s.reconciliationStatus ? (
                      <StatusBadge status={s.reconciliationStatus} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (type === "verification") {
    const data = await verificationReport();
    content = (
      <div className="space-y-6">
        <TwoCol
          leftTitle="By status"
          left={data.byStatus.map((r) => ({ label: r.status, value: r.count }))}
          rightTitle="By type"
          right={data.byType.map((r) => ({ label: r.type, value: r.count }))}
        />
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Active queue
          </div>
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.queue.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <Link href={`/admin/verification/${c.id}`} className="font-mono text-xs text-primary hover:underline">
                      {c.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.subject}</td>
                  <td className="px-4 py-2">{c.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2">{formatDate(c.scheduledDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (type === "complaints") {
    const data = await complaintsReport();
    content = (
      <div className="space-y-6">
        <TwoCol
          leftTitle="By status"
          left={data.byStatus.map((r) => ({ label: r.status, value: r.count }))}
          rightTitle="By category"
          right={data.byCategory.map((r) => ({ label: r.category, value: r.count }))}
        />
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Open complaints
          </div>
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Priority</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.open.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-mono text-xs">{c.reference}</td>
                  <td className="px-4 py-2">{c.subject}</td>
                  <td className="px-4 py-2">{c.category}</td>
                  <td className="px-4 py-2">{c.priority}</td>
                  <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live operational and financial analytics from the production database
          </p>
        </div>
        {canExport && (
          <DownloadButton
            href={`/api/reports?type=${encodeURIComponent(type)}&format=csv`}
            label="Export CSV"
            fileName={`kscspms-${type}-report.csv`}
            variant="primary"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const active = type === r.type;
          return (
            <Link
              key={r.type}
              href={`/admin/reports?type=${r.type}`}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {r.label}
            </Link>
          );
        })}
      </div>

      {content}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TwoCol({
  leftTitle,
  left,
  rightTitle,
  right,
}: {
  leftTitle: string;
  left: { label: string; value: number }[];
  rightTitle: string;
  right: { label: string; value: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CountCard title={leftTitle} rows={left} />
      <CountCard title={rightTitle} rows={right} />
    </div>
  );
}

function CountCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-white shadow-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-slate-900">
        {title}
      </div>
      <ul className="divide-y divide-border text-sm">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-slate-500">No data</li>
        ) : (
          rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between px-4 py-2">
              <span className="text-slate-700">{r.label.replace(/_/g, " ")}</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {r.value.toLocaleString()}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
