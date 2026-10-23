import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { redirect } from "next/navigation";
import { CreateVerificationForm } from "./CreateVerificationForm";

interface SearchParams {
  q?: string;
  page?: string;
  status?: string;
}

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.VERIFICATION_READ) &&
    !hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)
  ) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 20;
  const status = params.status;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      {
        employee: {
          OR: [
            { staffNumber: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
      },
      {
        pensioner: {
          pensionerNumber: { contains: q, mode: "insensitive" },
        },
      },
    ];
  }

  const [cases, total, employees, pensioners] = await Promise.all([
    prisma.verificationCase.findMany({
      where,
      include: {
        employee: {
          select: { staffNumber: true, firstName: true, lastName: true },
        },
        pensioner: {
          select: { pensionerNumber: true, bankAccountName: true },
        },
        evidence: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.verificationCase.count({ where }),
    prisma.employee.findMany({
      where: { isArchived: false },
      select: { id: true, staffNumber: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
      take: 150,
    }),
    prisma.pensioner.findMany({
      where: { isActive: true },
      select: {
        id: true,
        pensionerNumber: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const canManage = hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Verification</h1>
        <p className="mt-1 text-sm text-slate-600">
          Employee and pensioner verification queue · {total.toLocaleString()} cases
        </p>
      </div>

      {canManage && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Schedule verification
          </h2>
          <CreateVerificationForm employees={employees} pensioners={pensioners} />
        </div>
      )}

      <form className="flex flex-wrap gap-3" method="get">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search reference, staff number, pensioner no..."
            className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select name="status" defaultValue={status || ""} className="rounded-md border border-border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="MORE_INFO">More info needed</option>
        </select>
        <button type="submit" className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {cases.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            {q || status ? "No cases match your filters." : "No verification cases yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Scheduled</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Evidence</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{c.reference}</td>
                    <td className="px-4 py-3">
                      {c.employee ? (
                        <span>
                          {c.employee.lastName}, {c.employee.firstName}
                          <span className="block text-xs text-slate-500">{c.employee.staffNumber}</span>
                        </span>
                      ) : c.pensioner ? (
                        <span>
                          {c.pensioner.bankAccountName || "Pensioner"}
                          <span className="block text-xs text-slate-500">{c.pensioner.pensionerNumber}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.verificationType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(c.scheduledDate)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{c.evidence.length}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/verification/${c.id}`} className="font-medium text-primary hover:underline">
                        Open
                      </Link>
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
                <Link href={`/admin/verification?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/admin/verification?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`} className="rounded border border-border px-3 py-1 hover:bg-slate-50">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
