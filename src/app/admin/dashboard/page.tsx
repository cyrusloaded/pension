import Link from "next/link";
import {
  Users,
  UserCog,
  FileText,
  Calculator,
  CreditCard,
  ClipboardCheck,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

async function getDashboardMetrics() {
  try {
    const [
      totalRegistered,
      totalPensioners,
      openRetirements,
      pendingAssessments,
      draftSchedules,
      pendingVerifications,
      openComplaints,
      newPlacements,
      awaitingAudit,
      awaitingDg,
      awaitingDfa,
      recentAudits,
      gratuityEntitlements,
    ] = await Promise.all([
      prisma.pensioner.count({
        where: {
          AND: [
            { paymentStatus: { not: "DECEASED" } },
            { placementStatus: { not: "DECEASED" } },
          ],
        },
      }),
      prisma.pensioner.count({ where: { isActive: true, paymentStatus: "ACTIVE" } }),
      prisma.retirementCase.count({ where: { status: "OPEN" } }),
      prisma.benefitAssessment.count({
        where: { status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] } },
      }),
      prisma.paymentSchedule.count({
        where: { status: { in: ["DRAFT", "PENDING_REVIEW"] } },
      }),
      prisma.verificationCase.count({
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      }),
      prisma.complaint.count({
        where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
      }),
      prisma.placementRecord.count({
        where: { status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] } },
      }),
      prisma.paymentSchedule.count({ where: { workflowStage: "INTERNAL_AUDIT" } }),
      prisma.paymentSchedule.count({ where: { workflowStage: "DG_APPROVAL" } }),
      prisma.paymentSchedule.count({ where: { workflowStage: "DFA_PAYMENT" } }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entityType: true,
          actorEmail: true,
          createdAt: true,
          outcome: true,
        },
      }),
      prisma.gratuityEntitlement.findMany({
        include: { installments: true },
        take: 500,
      }),
    ]);

    let outstandingGratuity = 0;
    for (const e of gratuityEntitlements) {
      const paid = e.installments
        .filter((i) => i.status === "PAID")
        .reduce((s, i) => s + Number(i.paidAmount ?? i.proposedAmount ?? 0), 0);
      outstandingGratuity += Math.max(0, Number(e.approvedAmount) - paid);
    }

    const totalDeceased = await prisma.pensioner.count({
      where: {
        OR: [{ paymentStatus: "DECEASED" }, { placementStatus: "DECEASED" }],
      },
    });

    return {
      totalRegistered,
      totalDeceased,
      totalPensioners,
      openRetirements,
      pendingAssessments,
      draftSchedules,
      pendingVerifications,
      openComplaints,
      newPlacements,
      awaitingAudit,
      awaitingDg,
      awaitingDfa,
      outstandingGratuity: Math.round(outstandingGratuity),
      recentAudits,
      error: null as string | null,
    };
  } catch (e) {
    console.error("Dashboard metrics error:", e);
    return {
      totalRegistered: 0,
      totalDeceased: 0,
      totalPensioners: 0,
      openRetirements: 0,
      pendingAssessments: 0,
      draftSchedules: 0,
      pendingVerifications: 0,
      openComplaints: 0,
      newPlacements: 0,
      awaitingAudit: 0,
      awaitingDg: 0,
      awaitingDfa: 0,
      outstandingGratuity: 0,
      recentAudits: [],
      error: "Unable to load metrics. Ensure the database is connected.",
    };
  }
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  const metrics = await getDashboardMetrics();

  const cards = [
    {
      label: "Registered (non-deceased)",
      value: metrics.totalRegistered ?? 0,
      icon: Users,
      href: "/admin/intake",
      color: "text-slate-700 bg-slate-100",
    },
    {
      label: "Active Pensioners",
      value: metrics.totalPensioners,
      icon: UserCog,
      href: "/admin/pensioners?paymentStatus=ACTIVE",
      color: "text-teal-600 bg-teal-50",
    },
    {
      label: "New Placements",
      value: metrics.newPlacements,
      icon: Users,
      href: "/admin/placements",
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Deceased records",
      value: metrics.totalDeceased ?? 0,
      icon: AlertCircle,
      href: "/admin/intake",
      color: "text-rose-600 bg-rose-50",
    },
    {
      label: "Outstanding Gratuity (₦)",
      value: metrics.outstandingGratuity,
      icon: Calculator,
      href: "/admin/gratuity",
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Awaiting Internal Audit",
      value: metrics.awaitingAudit,
      icon: ClipboardCheck,
      href: "/admin/payment-schedules",
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Awaiting DG Approval",
      value: metrics.awaitingDg,
      icon: FileText,
      href: "/admin/payment-schedules",
      color: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Awaiting DFA Payment",
      value: metrics.awaitingDfa,
      icon: CreditCard,
      href: "/admin/payment-schedules",
      color: "text-cyan-600 bg-cyan-50",
    },
    {
      label: "Open Retirement Cases",
      value: metrics.openRetirements,
      icon: FileText,
      href: "/admin/retirements",
      color: "text-orange-600 bg-orange-50",
    },
    {
      label: "Open Complaints",
      value: metrics.openComplaints,
      icon: AlertCircle,
      href: "/admin/complaints",
      color: "text-red-600 bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome, {session?.firstName}. SRS executive overview (placements, gratuity, approval queues) as of{" "}
          {formatDateTime(new Date())}.
        </p>
      </div>

      {metrics.error && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {metrics.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-lg border border-border bg-white p-5 shadow-card transition hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {card.value.toLocaleString()}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}
              >
                <card.icon className="h-5 w-5" aria-hidden />
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
              View details
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-white shadow-card">
        
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Module shortcuts</h2>
        <p className="mb-3 text-sm text-slate-600">
          All menus share the same database, session, and permission model.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            ["/admin/intake", "Register retired / deceased"],
            ["/admin/pensioners", "Pensioners"],
            ["/admin/placements", "New placements"],
            ["/admin/organizations", "Organizations"],
            ["/admin/retirements", "Retirements"],
            ["/admin/verification", "Verification"],
            ["/admin/benefits", "Benefits"],
            ["/admin/approvals", "Approvals"],
            ["/admin/gratuity", "Gratuity"],
            ["/admin/beneficiaries", "Beneficiary claims"],
            ["/admin/payment-schedules", "Payment schedules"],
            ["/admin/payment-schedules/import", "Import payment schedule"],
            ["/admin/arrears", "Arrears"],
            ["/admin/reconciliation", "Reconciliation"],
            ["/admin/bank-changes", "Bank detail changes"],
            ["/admin/reports", "Reports"],
            ["/admin/notifications", "Notifications"],
            ["/admin/users", "Users"],
            ["/admin/roles", "Roles"],
            ["/admin/pension-rules", "Pension rules"],
            ["/admin/audit-logs", "Audit logs"],
            ["/admin/settings", "Settings"],
            ["/admin/import-history", "Import history"],
            ["/admin/complaints", "Complaints"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition hover:border-primary hover:text-primary"
            >
              <span>{label}</span>
              <ArrowRight className="h-4 w-4 opacity-50" />
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Recent Activity
          </h2>
          <Link
            href="/admin/audit-logs"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {metrics.recentAudits.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No recent activity recorded. Activity will appear here as officers
            use the system.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {metrics.recentAudits.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {log.action}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    · {log.entityType}
                    {log.actorEmail ? ` · ${log.actorEmail}` : ""}
                  </span>
                </div>
                <time className="text-xs text-slate-400">
                  {formatDateTime(log.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
