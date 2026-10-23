import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Wallet,
  ClipboardCheck,
  MessageSquare,
  Bell,
  FileText,
  User,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { prisma } from "@/lib/database/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function PortalDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pensioner = await getPensionerForUser(session);

  const [lastPayment, openComplaints, unreadNotifs, pendingVerification] =
    await Promise.all([
      pensioner
        ? prisma.paymentScheduleItem.findFirst({
            where: {
              pensionerId: pensioner.id,
              status: { in: ["SUCCESSFUL", "PENDING"] },
            },
            include: {
              schedule: {
                select: { paymentPeriod: true, status: true },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : null,
      pensioner
        ? prisma.complaint.count({
            where: {
              pensionerId: pensioner.id,
              status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
            },
          })
        : 0,
      prisma.notification.count({
        where: { userId: session.id, isRead: false },
      }),
      pensioner
        ? prisma.verificationCase.findFirst({
            where: {
              pensionerId: pensioner.id,
              status: { in: ["PENDING", "IN_PROGRESS", "MORE_INFO"] },
            },
            orderBy: { createdAt: "desc" },
          })
        : null,
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome, {session.firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your pensioner self-service dashboard
        </p>
      </div>

      {!pensioner ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          <p className="font-semibold">No pensioner record linked</p>
          <p className="mt-1">
            Your login account is not linked to a pensioner profile yet. Please
            contact the Pension Board for enrolment or account linkage.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Payment status"
              value={pensioner.paymentStatus}
              badge
            />
            <Stat
              label="Monthly pension"
              value={
                pensioner.monthlyPension != null
                  ? formatCurrency(Number(pensioner.monthlyPension))
                  : "—"
              }
            />
            <Stat
              label="Verification"
              value={pensioner.verificationStatus}
              badge
            />
            <Stat
              label="Unread alerts"
              value={String(unreadNotifs)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-white p-5 shadow-card">
              <h2 className="text-base font-semibold text-slate-900">
                Account summary
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Pensioner number" value={pensioner.pensionerNumber} mono />
                <Row
                  label="Scheme"
                  value={pensioner.pensionScheme?.name || "—"}
                />
                <Row
                  label="Organization"
                  value={
                    pensioner.organization?.name ||
                    pensioner.employee?.organization?.name ||
                    "—"
                  }
                />
                <Row
                  label="Retirement date"
                  value={formatDate(pensioner.retirementDate)}
                />
                <Row
                  label="Last payment period"
                  value={
                    lastPayment
                      ? `${lastPayment.schedule.paymentPeriod} (${formatCurrency(Number(lastPayment.netAmount))})`
                      : "No payments recorded"
                  }
                />
              </dl>
            </section>

            <section className="rounded-lg border border-border bg-white p-5 shadow-card">
              <h2 className="text-base font-semibold text-slate-900">
                Quick actions
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                <Action href="/portal/profile" icon={User} label="View profile" />
                <Action href="/portal/payments" icon={Wallet} label="Payment history" />
                <Action href="/portal/documents" icon={FileText} label="Documents" />
                <Action
                  href="/portal/verification"
                  icon={ClipboardCheck}
                  label="Verification"
                />
                <Action
                  href="/portal/complaints"
                  icon={MessageSquare}
                  label={`Complaints${openComplaints ? ` (${openComplaints})` : ""}`}
                />
                <Action
                  href="/portal/notifications"
                  icon={Bell}
                  label={`Notifications${unreadNotifs ? ` (${unreadNotifs})` : ""}`}
                />
              </ul>
              {pendingVerification && (
                <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  You have an open verification case (
                  {pendingVerification.reference}) — status{" "}
                  <StatusBadge status={pendingVerification.status} />
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1">
        {badge ? (
          <StatusBadge status={value} />
        ) : (
          <p className="text-lg font-semibold text-slate-900">{value}</p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-right font-medium text-slate-900 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Action({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {label}
      </Link>
    </li>
  );
}
