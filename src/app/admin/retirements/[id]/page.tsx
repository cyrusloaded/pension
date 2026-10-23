import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import {
  getAllowedTransitions,
  stageLabel,
  REQUIRED_DOCUMENTS,
  type RetirementStage,
} from "@/lib/workflows/retirement";
import { TransitionForm } from "./TransitionForm";
import { DocumentRegisterForm } from "./DocumentRegisterForm";

export default async function RetirementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.RETIREMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW)
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const rc = await prisma.retirementCase.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          organization: true,
          serviceHistory: { orderBy: { startDate: "desc" }, take: 5 },
        },
      },
      pensionScheme: true,
      assignedOfficer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      timeline: { orderBy: { createdAt: "asc" } },
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      pensioner: {
        select: {
          id: true,
          pensionerNumber: true,
          paymentStatus: true,
        },
      },
    },
  });

  if (!rc) notFound();

  const allowed = getAllowedTransitions(rc.currentStage as RetirementStage);
  const canTransition =
    hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW) ||
    hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) ||
    hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) ||
    hasPermission(session, PERMISSIONS.BENEFITS_APPROVE) ||
    hasPermission(session, PERMISSIONS.PENSIONERS_CREATE);
  const canAddDocs =
    hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) ||
    hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW);

  const uploadedTypes = new Set(rc.documents.map((d) => d.documentType));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/retirements"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Retirement cases
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {rc.caseReference}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>
            {rc.employee.lastName}, {rc.employee.firstName} ({rc.employee.staffNumber})
          </span>
          <StatusBadge status={rc.status} />
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {stageLabel(rc.currentStage)}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Organization" value={rc.employee.organization.name} />
        <InfoCard label="Scheme" value={rc.pensionScheme?.name || "—"} />
        <InfoCard label="Expected retirement" value={formatDate(rc.expectedRetirementDate)} />
        <InfoCard
          label="Assigned officer"
          value={
            rc.assignedOfficer
              ? `${rc.assignedOfficer.firstName} ${rc.assignedOfficer.lastName}`
              : "—"
          }
        />
      </div>

      {/* Workflow transition */}
      {rc.status === "OPEN" && allowed.length > 0 && canTransition && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Advance workflow
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Current stage: <strong>{stageLabel(rc.currentStage)}</strong>. Only
            permitted next stages are available — the server validates every transition.
          </p>
          <TransitionForm caseId={rc.id} allowedStages={allowed} />
        </section>
      )}

      {/* Document checklist */}
      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Required documents
        </h2>
        <ul className="mb-4 grid gap-2 sm:grid-cols-2">
          {REQUIRED_DOCUMENTS.map((doc) => (
            <li
              key={doc.code}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  uploadedTypes.has(doc.code) ? "bg-green-500" : "bg-slate-300"
                }`}
              />
              {doc.label}
              {uploadedTypes.has(doc.code) && (
                <span className="text-xs text-green-600">Submitted</span>
              )}
            </li>
          ))}
        </ul>

        {rc.documents.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">File</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Uploaded</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rc.documents.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2">{d.documentType.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.fileName}</td>
                    <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-2 text-slate-500">{formatDateTime(d.uploadedAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <DownloadButton
                        href={`/api/documents/${d.id}/download`}
                        label="Download"
                        fileName={d.fileName}
                        variant="link"
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canAddDocs && rc.status === "OPEN" && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Register document (metadata)
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Records document reference. Binary files should be stored in private
              object storage; enter the storage key as the file path.
            </p>
            <DocumentRegisterForm caseId={rc.id} />
          </div>
        )}
      </section>

      {/* Linked employee service */}
      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Employee service snapshot
        </h2>
        <p className="mb-2 text-sm">
          <Link
            href={`/admin/employees/${rc.employee.id}`}
            className="font-medium text-primary hover:underline"
          >
            View full employee record
          </Link>
        </p>
        {rc.employee.serviceHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No service history on file.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {rc.employee.serviceHistory.map((s) => (
              <li key={s.id}>
                {formatDate(s.startDate)} – {s.endDate ? formatDate(s.endDate) : "Present"}:{" "}
                {s.jobTitle || "—"} ({s.gradeLevel || "—"})
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Assessments */}
      {rc.assessments.length > 0 && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Benefit assessments
          </h2>
          <ul className="space-y-2 text-sm">
            {rc.assessments.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="font-mono text-xs">{a.assessmentRef}</span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pensioner link */}
      {rc.pensioner && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Enrolled pensioner
          </h2>
          <Link
            href={`/admin/pensioners/${rc.pensioner.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {rc.pensioner.pensionerNumber}
          </Link>{" "}
          <StatusBadge status={rc.pensioner.paymentStatus} />
        </section>
      )}

      {/* Timeline */}
      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Case timeline
        </h2>
        {rc.timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline events.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {rc.timeline.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[21px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <p className="text-sm font-medium text-slate-900">
                  {t.action.replace(/_/g, " ")} · {stageLabel(t.stage)}
                </p>
                {t.comments && (
                  <p className="mt-0.5 text-sm text-slate-600">{t.comments}</p>
                )}
                <time className="text-xs text-slate-400">
                  {formatDateTime(t.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      {rc.notes && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Notes</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{rc.notes}</p>
        </section>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
