import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CalculateForm } from "./CalculateForm";
import { BenefitDecisionForm } from "./BenefitDecisionForm";

export default async function BenefitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_READ)
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const assessment = await prisma.benefitAssessment.findUnique({
    where: { id },
    include: {
      retirementCase: {
        include: {
          employee: {
            include: {
              organization: true,
              salaryHistory: { orderBy: { effectiveDate: "desc" }, take: 3 },
            },
          },
          pensionScheme: true,
        },
      },
      ruleVersion: true,
    },
  });

  if (!assessment) notFound();

  const canCalculate =
    hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) &&
    ["DRAFT", "RETURNED"].includes(assessment.status);
  const canSubmit =
    hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) &&
    ["DRAFT", "RETURNED"].includes(assessment.status);
  const canReview =
    (hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) ||
      hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)) &&
    ["SUBMITTED", "UNDER_REVIEW"].includes(assessment.status);
  const canApprove =
    hasPermission(session, PERMISSIONS.BENEFITS_APPROVE) &&
    ["SUBMITTED", "UNDER_REVIEW"].includes(assessment.status);

  const breakdown = assessment.calculationBreakdown as
    | { label: string; value: string | number | null; note?: string }[]
    | null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/benefits"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Benefit assessments
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {assessment.assessmentRef}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Link
            href={`/admin/retirements/${assessment.retirementCase.id}`}
            className="font-medium text-primary hover:underline"
          >
            {assessment.retirementCase.caseReference}
          </Link>
          <span>
            {assessment.retirementCase.employee.lastName},{" "}
            {assessment.retirementCase.employee.firstName}
          </span>
          <StatusBadge status={assessment.status} />
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Monthly pension"
          value={
            assessment.monthlyPension != null
              ? formatCurrency(Number(assessment.monthlyPension))
              : "—"
          }
        />
        <Card
          label="Gratuity"
          value={
            assessment.gratuityAmount != null
              ? formatCurrency(Number(assessment.gratuityAmount))
              : "—"
          }
        />
        <Card
          label="Net entitlement"
          value={
            assessment.netEntitlement != null
              ? formatCurrency(Number(assessment.netEntitlement))
              : "—"
          }
        />
        <Card
          label="Rule version"
          value={assessment.ruleVersion?.version || "None"}
        />
      </div>

      {assessment.warnings && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 whitespace-pre-wrap"
        >
          {assessment.warnings}
        </div>
      )}

      <section className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Inputs</h2>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Qualifying service (years)</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {assessment.qualifyingServiceYears != null
                ? Number(assessment.qualifyingServiceYears)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Final salary</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {assessment.finalSalary != null
                ? formatCurrency(Number(assessment.finalSalary))
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Scheme</dt>
            <dd className="mt-0.5 text-slate-900">
              {assessment.retirementCase.pensionScheme?.name || "—"}
            </dd>
          </div>
        </dl>
      </section>

      {breakdown && Array.isArray(breakdown) && breakdown.length > 0 && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Calculation breakdown
          </h2>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-border">
              {breakdown.map((line, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4 text-slate-600">{line.label}</td>
                  <td className="py-2 text-right font-medium tabular-nums text-slate-900">
                    {typeof line.value === "number"
                      ? line.value.toLocaleString("en-NG")
                      : line.value ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canCalculate && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Recalculate
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Amounts are computed on the server using the approved rule version.
            Officers cannot type over calculated totals.
          </p>
          <CalculateForm
            assessmentId={assessment.id}
            defaultYears={
              assessment.qualifyingServiceYears != null
                ? Number(assessment.qualifyingServiceYears)
                : undefined
            }
            defaultSalary={
              assessment.finalSalary != null
                ? Number(assessment.finalSalary)
                : undefined
            }
            ruleVersionId={assessment.ruleVersionId}
          />
        </section>
      )}

      {(canSubmit || canReview || canApprove) && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Workflow actions
          </h2>
          <BenefitDecisionForm
            assessmentId={assessment.id}
            canSubmit={canSubmit}
            canReturn={canReview}
            canApprove={canApprove}
            canReject={canReview}
          />
        </section>
      )}

      {assessment.reviewerComments && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Reviewer comments
          </h2>
          <p className="text-sm text-slate-700">{assessment.reviewerComments}</p>
        </section>
      )}

      <section className="rounded-lg border border-border bg-white p-5 shadow-card text-sm text-slate-600">
        <p>
          Assessed: {formatDateTime(assessment.assessedAt)} · Reviewed:{" "}
          {formatDateTime(assessment.reviewedAt)} · Approved:{" "}
          {formatDateTime(assessment.approvedAt)}
        </p>
      </section>
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
