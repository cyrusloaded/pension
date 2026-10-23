import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { stageLabel } from "@/lib/workflows/retirement";
import { redirect } from "next/navigation";
import { CreateRetirementForm } from "./CreateRetirementForm";

interface SearchParams {
  q?: string;
  page?: string;
  stage?: string;
  status?: string;
}

export default async function RetirementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 20;
  const stage = params.stage;
  const status = params.status;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { caseReference: { contains: q, mode: "insensitive" } },
      {
        employee: {
          OR: [
            { staffNumber: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  if (stage) where.currentStage = stage;
  if (status) where.status = status;

  const [cases, total, employees, schemes] = await Promise.all([
    prisma.retirementCase.findMany({
      where,
      include: {
        employee: {
          select: {
            staffNumber: true,
            firstName: true,
            lastName: true,
            organization: { select: { name: true } },
          },
        },
        assignedOfficer: { select: { firstName: true, lastName: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.retirementCase.count({ where }),
    prisma.employee.findMany({
      where: {
        isArchived: false,
        employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      select: { id: true, staffNumber: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
      take: 200,
    }),
    prisma.pensionScheme.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const canCreate = hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Retirement Cases</h1>
        <p className="mt-1 text-sm text-slate-600">
          End-to-end retirement workflow · {total.toLocaleString()} cases
        </p>
      </div>

      {canCreate && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Initiate retirement case
          </h2>
          <CreateRetirementForm employees={employees} schemes={schemes} />
        </div>
      )}

      <form className="flex flex-wrap gap-3" method="get">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search case ref, staff number, name..."
            className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select name="stage" defaultValue={stage || ""} className="rounded-md border border-border px-3 py-2 text-sm">
          <option value="">All stages</option>
          <option value="ELIGIBILITY_ASSESSMENT">Eligibility</option>
          <option value="DOCUMENT_SUBMISSION">Documents</option>
          <option value="SERVICE_VERIFICATION">Service verification</option>
          <option value="CASE_REVIEW">Case review</option>
          <option value="MISSING_INFO">Missing info</option>
          <option value="BENEFIT_ASSESSMENT">Benefit assessment</option>
          <option value="CALCULATION_REVIEW">Calculation review</option>
          <option value="APPROVAL">Approval</option>
          <option value="PENSIONER_ENROLMENT">Enrolment</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select name="status" defaultValue={status || ""} className="rounded-md border border-border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ON_HOLD">On hold</option>
          <option value="CLOSED">Closed</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button type="submit" className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {cases.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            {q || stage || status ? "No cases match your filters." : "No retirement cases yet. Initiate one above."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Organization</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Stage</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Expected</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Docs</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{c.caseReference}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{c.employee.lastName}, {c.employee.firstName}</span>
                      <span className="block text-xs text-slate-500">{c.employee.staffNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.employee.organization?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{stageLabel(c.currentStage)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(c.expectedRetirementDate)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{c._count.documents}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/retirements/${c.id}`} className="font-medium text-primary hover:underline">Open</Link>
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
                <Link href={`/admin/retirements?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${stage ? `&stage=${stage}` : ""}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/admin/retirements?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${stage ? `&stage=${stage}` : ""}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
