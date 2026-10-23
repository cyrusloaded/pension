import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { redirect } from "next/navigation";
import { OrganizationForm } from "./OrganizationForm";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManage = hasPermission(session, PERMISSIONS.ORGANIZATIONS_MANAGE);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || "25", 10)));
  const q = params.q?.trim() || "";
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, organizations] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      include: {
        parent: { select: { name: true, code: true } },
        _count: { select: { employees: true, children: true } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ministries, departments, agencies, and LGAs ·{" "}
            {total} records · page {page}/{totalPages}
          </p>
        </div>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search code or name" className="rounded-md border px-3 py-2 text-sm" />
        <select name="pageSize" defaultValue={String(pageSize)} className="rounded-md border px-3 py-2 text-sm">
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white">Search</button>
      </form>

      {canManage && (
        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Add Organization
          </h2>
          <OrganizationForm
            parents={organizations.map((o) => ({
              id: o.id,
              name: o.name,
              code: o.code,
            }))}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {organizations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              No organizations yet. Add the first ministry or agency above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Parent
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Employees
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-slate-900">
                      {org.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {org.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {org.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {org.parent
                        ? `${org.parent.name} (${org.parent.code})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {org._count.employees}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={org.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Link className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/admin/organizations?page=1&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}>First</Link>
          <Link className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/admin/organizations?page=${page - 1}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}>Prev</Link>
          <Link className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={`/admin/organizations?page=${page + 1}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}>Next</Link>
          <Link className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={`/admin/organizations?page=${totalPages}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}>Last</Link>
        </div>
      </div>
    </div>
  );
}
