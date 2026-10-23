import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { redirect } from "next/navigation";

interface SearchParams {
  q?: string;
  page?: string;
  paymentStatus?: string;
}

export default async function PensionersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, PERMISSIONS.PENSIONERS_READ)) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 20;
  const paymentStatus = params.paymentStatus;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { pensionerNumber: { contains: q, mode: "insensitive" } },
      { bankAccountName: { contains: q, mode: "insensitive" } },
      {
        employee: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { staffNumber: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  if (paymentStatus) where.paymentStatus = paymentStatus;

  const [pensioners, total] = await Promise.all([
    prisma.pensioner.findMany({
      where,
      include: {
        employee: {
          select: {
            staffNumber: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        organization: { select: { name: true, code: true } },
        pensionScheme: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pensioner.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pensioners</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enrolled pensioner registry · {total.toLocaleString()} records
        </p>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by pensioner no., name, or staff number..."
            className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          name="paymentStatus"
          defaultValue={paymentStatus || ""}
          className="rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All payment statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="STOPPED">Stopped</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {pensioners.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            {q || paymentStatus
              ? "No pensioners match your filters."
              : "No pensioners enrolled yet. Enrolment typically follows retirement case approval."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Pensioner No.</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Staff No.</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Organization</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Monthly</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Verification</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Retired</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pensioners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">
                      {p.pensionerNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {p.employee
                        ? `${p.employee.lastName}, ${p.employee.firstName}`
                        : p.bankAccountName || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.employee?.staffNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.organization?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.monthlyPension != null
                        ? formatCurrency(Number(p.monthlyPension))
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.paymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.verificationStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(p.retirementDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/pensioners/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        View
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
            <p className="text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/pensioners?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${paymentStatus ? `&paymentStatus=${paymentStatus}` : ""}`}
                  className="rounded border border-border px-3 py-1 hover:bg-slate-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/pensioners?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${paymentStatus ? `&paymentStatus=${paymentStatus}` : ""}`}
                  className="rounded border border-border px-3 py-1 hover:bg-slate-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
