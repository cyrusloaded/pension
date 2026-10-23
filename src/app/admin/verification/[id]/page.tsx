import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DecisionForm } from "./DecisionForm";

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.VERIFICATION_READ) &&
    !hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const vc = await prisma.verificationCase.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          organization: { select: { name: true, code: true } },
        },
      },
      pensioner: {
        include: {
          employee: {
            select: { staffNumber: true, firstName: true, lastName: true },
          },
        },
      },
      evidence: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!vc) notFound();

  const canDecide =
    hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE) &&
    !["APPROVED", "REJECTED"].includes(vc.status);

  const subjectName = vc.employee
    ? `${vc.employee.lastName}, ${vc.employee.firstName}`
    : vc.pensioner?.employee
      ? `${vc.pensioner.employee.lastName}, ${vc.pensioner.employee.firstName}`
      : vc.pensioner?.pensionerNumber || "—";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/verification"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Verification
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{vc.reference}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{subjectName}</span>
          <StatusBadge status={vc.status} />
          <span className="text-slate-500">{vc.verificationType.replace(/_/g, " ")}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Scheduled" value={formatDate(vc.scheduledDate)} />
        <InfoCard label="Completed" value={formatDate(vc.completedDate)} />
        <InfoCard label="Decision" value={vc.decision || "—"} />
        <InfoCard label="Evidence items" value={String(vc.evidence.length)} />
      </div>

      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Subject</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          {vc.employee && (
            <>
              <div>
                <dt className="text-xs font-medium text-slate-500">Employee</dt>
                <dd className="mt-0.5">
                  <Link href={`/admin/employees/${vc.employee.id}`} className="text-primary hover:underline">
                    {vc.employee.staffNumber}
                  </Link>{" "}
                  — {vc.employee.lastName}, {vc.employee.firstName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Organization</dt>
                <dd className="mt-0.5 text-slate-900">{vc.employee.organization?.name || "—"}</dd>
              </div>
            </>
          )}
          {vc.pensioner && (
            <div>
              <dt className="text-xs font-medium text-slate-500">Pensioner</dt>
              <dd className="mt-0.5">
                <Link href={`/admin/pensioners/${vc.pensioner.id}`} className="text-primary hover:underline">
                  {vc.pensioner.pensionerNumber}
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {vc.decisionReason && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Decision reason</h2>
          <p className="text-sm text-slate-700">{vc.decisionReason}</p>
          {vc.decidedAt && (
            <p className="mt-2 text-xs text-slate-400">Decided {formatDateTime(vc.decidedAt)}</p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Evidence</h2>
        {vc.evidence.length === 0 ? (
          <p className="text-sm text-slate-500">No evidence recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {vc.evidence.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded border border-border px-3 py-2">
                <span className="font-medium text-slate-800">{e.evidenceType}</span>
                {e.fileName && <span className="font-mono text-xs text-slate-500">{e.fileName}</span>}
                {e.description && <span className="text-slate-600">{e.description}</span>}
                <span className="ml-auto text-xs text-slate-400">{formatDateTime(e.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canDecide && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Record decision</h2>
          <p className="mb-4 text-sm text-slate-600">
            Approving updates the linked pensioner verification status. A failed
            verification does not automatically cancel entitlement — follow policy
            and authorized review.
          </p>
          <DecisionForm caseId={vc.id} />
        </section>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
