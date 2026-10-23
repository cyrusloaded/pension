import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface SearchParams {
  q?: string;
  action?: string;
  entityType?: string;
  page?: string;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.AUDIT_READ) &&
    !session.roles.includes("SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const action = params.action?.trim() || "";
  const entityType = params.entityType?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entityType) where.entityType = entityType;
  if (q) {
    where.OR = [
      { actorEmail: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      { reason: { contains: q, mode: "insensitive" } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Immutable activity trail · {total.toLocaleString()} records
        </p>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search actor, action, entity id, reason..."
            className="w-full rounded-md border border-border py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          name="action"
          defaultValue={action}
          placeholder="Action filter"
          className="rounded-md border border-border px-3 py-2 text-sm"
        />
        <input
          name="entityType"
          defaultValue={entityType}
          placeholder="Entity type"
          className="rounded-md border border-border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {logs.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No audit entries match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">When</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Actor</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Action</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Entity</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Outcome</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Reason / IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-slate-800">
                        {log.actorEmail || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-medium text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-medium text-slate-700">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="block max-w-[140px] truncate font-mono text-[10px] text-slate-400">
                          {log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={log.outcome} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {log.reason && <p>{log.reason}</p>}
                      {log.ipAddress && (
                        <p className="font-mono text-[10px] text-slate-400">
                          {log.ipAddress}
                        </p>
                      )}
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
                  href={`/admin/audit-logs?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${action ? `&action=${encodeURIComponent(action)}` : ""}${entityType ? `&entityType=${encodeURIComponent(entityType)}` : ""}`}
                  className="rounded border border-border px-3 py-1 hover:bg-slate-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/audit-logs?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${action ? `&action=${encodeURIComponent(action)}` : ""}${entityType ? `&entityType=${encodeURIComponent(entityType)}` : ""}`}
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
