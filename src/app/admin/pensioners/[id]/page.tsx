import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DeathReportPanel } from "./DeathReportPanel";
import { NokClaimForm } from "./NokClaimForm";
import { ArchivePanel } from "./ArchivePanel";

export default async function PensionerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, PERMISSIONS.PENSIONERS_READ)) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const pensioner = await prisma.pensioner.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          serviceHistory: { orderBy: { startDate: "desc" }, take: 20 },
          salaryHistory: { orderBy: { effectiveDate: "desc" }, take: 10 },
        },
      },
      organization: true,
      pensionScheme: true,
      retirementCase: {
        select: {
          id: true,
          caseReference: true,
          currentStage: true,
          status: true,
        },
      },
      placementRecords: { orderBy: { placementDate: "desc" }, take: 10 },
      paymentItems: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          schedule: {
            select: { scheduleRef: true, paymentPeriod: true, status: true },
          },
        },
      },
      nextOfKinClaims: { orderBy: { createdAt: "desc" }, take: 10 },
      verificationCases: { orderBy: { createdAt: "desc" }, take: 10 },
      gratuityEntitlement: { include: { installments: true } },
    },
  });

  if (!pensioner) notFound();

  const activities = await prisma.recordActivity
    .findMany({
      where: { entityType: "Pensioner", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    })
    .catch(() => []);

  const audits = await prisma.auditLog.findMany({
    where: { entityType: "Pensioner", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const name = pensioner.employee
    ? `${pensioner.employee.lastName}, ${pensioner.employee.firstName}`
    : pensioner.bankAccountName || "—";

  const canUpdate = hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE);
  const isDeceased =
    pensioner.paymentStatus === "DECEASED" ||
    pensioner.placementStatus === "DECEASED";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/pensioners"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Pensioners
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="font-mono font-medium">
            {pensioner.pensionerNumber}
          </span>
          <StatusBadge status={pensioner.paymentStatus} />
          <StatusBadge status={pensioner.placementStatus || "—"} />
          <StatusBadge status={pensioner.verificationStatus} />
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Monthly pension"
          value={
            pensioner.monthlyPension != null
              ? formatCurrency(Number(pensioner.monthlyPension))
              : "—"
          }
        />
        <Card
          label="Lifecycle"
          value={
            isDeceased
              ? "Deceased"
              : pensioner.placementStatus === "NEW_PLACEMENT"
                ? "New placement"
                : pensioner.placementStatus === "ACTIVE"
                  ? "Active pensioner"
                  : pensioner.placementStatus || pensioner.paymentStatus
          }
        />
        <Card
          label="Retirement date"
          value={formatDate(pensioner.retirementDate)}
        />
        <Card
          label="MDA"
          value={pensioner.organization?.name || "—"}
        />
      </div>

      <Section title="Master profile">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <Item label="Service number" value={pensioner.employee?.staffNumber} />
          <Item label="Gender" value={pensioner.employee?.gender} />
          <Item label="Phone" value={pensioner.employee?.phone} />
          <Item label="Grade" value={pensioner.employee?.gradeLevel} />
          <Item label="Designation" value={pensioner.employee?.jobTitle} />
          <Item
            label="Date of birth"
            value={formatDate(pensioner.employee?.dateOfBirth)}
          />
          <Item label="Bank" value={pensioner.bankName} />
          <Item label="Account" value={pensioner.bankAccountNumber} />
          <Item label="Account name" value={pensioner.bankAccountName} />
          <Item
            label="Death verification"
            value={pensioner.deathVerificationStatus || "—"}
          />
          <Item label="Date of death" value={formatDate(pensioner.dateOfDeath)} />
          <Item label="Status reason" value={pensioner.statusReason} />
        </dl>
      </Section>

      <Section title="Service particulars (history)">
        <p className="mb-2 text-xs text-slate-500">
          Historical postings and grades — previous rows are retained.
        </p>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1">Period</th>
              <th className="px-2 py-1">Title / grade</th>
              <th className="px-2 py-1">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(pensioner.employee?.serviceHistory || []).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-2 py-1">
                  {formatDate(s.startDate)} – {formatDate(s.endDate) || "…"}
                </td>
                <td className="px-2 py-1">
                  {s.jobTitle || "—"} / {s.gradeLevel || "—"}
                </td>
                <td className="px-2 py-1 text-xs text-slate-600">
                  {s.remarks || "—"}
                </td>
              </tr>
            ))}
            {(pensioner.employee?.serviceHistory || []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-slate-500">
                  No service history rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Placement history">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1">Category</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Placed</th>
              <th className="px-2 py-1">Activated</th>
            </tr>
          </thead>
          <tbody>
            {pensioner.placementRecords.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-2 py-1">{p.category}</td>
                <td className="px-2 py-1">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-2 py-1">{formatDate(p.placementDate)}</td>
                <td className="px-2 py-1">{formatDate(p.activationDate)}</td>
              </tr>
            ))}
            {pensioner.placementRecords.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-slate-500">
                  No placement records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Link
          href="/admin/placements"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          Open new placements queue
        </Link>
      </Section>

      <Section title="Payment history">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1">Period</th>
              <th className="px-2 py-1">Schedule</th>
              <th className="px-2 py-1 text-right">Amount</th>
              <th className="px-2 py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {pensioner.paymentItems.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-2 py-1">
                  {i.schedule?.paymentPeriod || "—"}
                </td>
                <td className="px-2 py-1 font-mono text-xs">
                  {i.schedule?.scheduleRef}
                </td>
                <td className="px-2 py-1 text-right">
                  {formatCurrency(Number(i.netAmount ?? i.amount))}
                </td>
                <td className="px-2 py-1">
                  <StatusBadge status={i.status} />
                </td>
              </tr>
            ))}
            {pensioner.paymentItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-slate-500">
                  No payment lines yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Beneficiary / NOK claims">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1">Reference</th>
              <th className="px-2 py-1">Claimant</th>
              <th className="px-2 py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {pensioner.nextOfKinClaims.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-2 py-1 font-mono text-xs">{c.reference}</td>
                <td className="px-2 py-1">
                  {c.claimantName} ({c.relationship})
                </td>
                <td className="px-2 py-1">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
            {pensioner.nextOfKinClaims.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-slate-500">
                  No claims. Claims do not auto-entitle payment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canUpdate && <NokClaimForm pensionerId={id} />}
        <Link
          href="/admin/beneficiaries"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          All beneficiary claims
        </Link>
      </Section>

      {canUpdate && pensioner.isActive && (
        <Section title="Archive (soft)">
          <p className="mb-2 text-xs text-slate-500">
            Deactivates the record and stops ordinary payroll eligibility.
            Does not delete payment history, approvals, or audit trails.
          </p>
          <ArchivePanel pensionerId={id} />
        </Section>
      )}

      {canUpdate && (
        <Section title="Death administration">
          <p className="mb-2 text-xs text-slate-500">
            Links to this master profile only. Blocks ordinary monthly pay.
            Does not approve next-of-kin benefits.
          </p>
          <DeathReportPanel
            pensionerId={id}
            currentStatus={pensioner.deathVerificationStatus}
          />
        </Section>
      )}

      <Section title="Record activity & audit">
        <ul className="space-y-2 text-sm">
          {activities.map((a) => (
            <li key={a.id} className="border-b border-slate-100 pb-2">
              <span className="font-medium">{a.eventType}</span>
              <span className="text-slate-500">
                {" "}
                · {formatDateTime(a.createdAt)}
              </span>
              {a.summary && (
                <div className="text-xs text-slate-600">{a.summary}</div>
              )}
            </li>
          ))}
          {audits.map((a) => (
            <li key={a.id} className="border-b border-slate-100 pb-2">
              <span className="font-medium">{a.action}</span>
              <span className="text-slate-500">
                {" "}
                · {formatDateTime(a.createdAt)} · {a.actorEmail}
              </span>
            </li>
          ))}
          {activities.length === 0 && audits.length === 0 && (
            <li className="text-slate-500">No history events yet.</li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-card">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Item({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
