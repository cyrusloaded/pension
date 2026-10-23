import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { redirect } from "next/navigation";
import { CreateAssessmentForm } from "./CreateAssessmentForm";

interface SearchParams {
  status?: string;
  page?: string;
}

export default async function BenefitsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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

  const params = await searchParams;
  const status = params.status;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 20;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [assessments, total, openCases] = await Promise.all([
    prisma.benefitAssessment.findMany({
      where,
      include: {
        retirementCase: {
          select: {
            caseReference: true,
            employee: {
              select: { staffNumber: true, firstName: true, lastName: true },
            },
          },
        },
        ruleVersion: { select: { version: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.benefitAssessment.count({ where }),
    prisma.retirementCase.findMany({
      where: {
        status: "OPEN",
        currentStage: {
          in: [
            "BENEFIT_ASSESSMENT",
            "CALCULATION_REVIEW",
            "CASE_REVIEW",
            "APPROVAL",
            "SERVICE_VERIFICATION",
          ],
        },
      },
      select: {
        id: true,
        caseReference: true,
        employee: {
          select: { staffNumber: true, firstName: true, lastName: true },
        },
      },
      take: 100,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const canCalculate = hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Benefit Assessments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Versioned calculations with independent review · {total.toLocaleString()} records
        </p>
      </div>

      {canCalculate && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            New assessment
          </h2>
          <CreateAssessmentForm cases={openCases} />
        </div>
      )}

      <form className="flex flex-wrap gap-3" method="get">
        <select name="status" defaultValue={status || ""} className="rounded-md border border-border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="RETURNED">Returned</option>
        </select>
        <button type="submit" className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {assessments.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No benefit assessments yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Case / Employee</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Rule</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Monthly</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Gratuity</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Assessed</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{a.assessmentRef}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{a.retirementCase.caseReference}</span>
                      <span className="block text-xs text-slate-500">
                        {a.retirementCase.employee.lastName}, {a.retirementCase.employee.firstName} ({a.retirementCase.employee.staffNumber})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.ruleVersion?.version || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.monthlyPension != null ? formatCurrency(Number(a.monthlyPension)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.gratuityAmount != null ? formatCurrency(Number(a.gratuityAmount)) : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(a.assessedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/benefits/${a.id}`} className="font-medium text-primary hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/admin/benefits?page=${page - 1}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/admin/benefits?page=${page + 1}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
