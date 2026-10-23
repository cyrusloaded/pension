import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ComplaintActions } from "./ComplaintActions";

interface SearchParams {
  status?: string;
  page?: string;
  pageSize?: string;
}

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.COMPLAINTS_READ) &&
    !hasPermission(session, PERMISSIONS.COMPLAINTS_MANAGE) &&
    !session.roles.includes("SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const status = params.status;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || "25", 10)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: {
        pensioner: {
          select: {
            pensionerNumber: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.complaint.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const canManage =
    hasPermission(session, PERMISSIONS.COMPLAINTS_MANAGE) ||
    session.roles.includes("SUPER_ADMIN");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Complaints</h1>
        <p className="mt-1 text-sm text-slate-600">
          Service desk queue · {total.toLocaleString()} total
        </p>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="status"
          defaultValue={status || ""}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-lg border border-border bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-card">
            No complaints found.
          </div>
        ) : (
          items.map((c) => (
            <article
              key={c.id}
              className="rounded-lg border border-border bg-white p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-sm font-medium">{c.reference}</span>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">
                    {c.subject}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.category} · {c.priority} · {formatDateTime(c.createdAt)}
                    {c.pensioner && (
                      <>
                        {" "}
                        · {c.pensioner.pensionerNumber}
                        {c.pensioner.employee &&
                          ` (${c.pensioner.employee.lastName}, ${c.pensioner.employee.firstName})`}
                      </>
                    )}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">
                {c.description}
              </p>
              {c.resolution && (
                <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Resolution
                  </p>
                  <p className="mt-1 text-slate-800">{c.resolution}</p>
                </div>
              )}
              {canManage && !["CLOSED"].includes(c.status) && (
                <div className="mt-4 border-t border-border pt-3">
                  <ComplaintActions
                    complaintId={c.id}
                    currentStatus={c.status}
                  />
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/complaints?page=${page - 1}${status ? `&status=${status}` : ""}`}
              className="rounded border border-border px-3 py-1 hover:bg-slate-50"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/admin/complaints?page=${page + 1}${status ? `&status=${status}` : ""}`}
              className="rounded border border-border px-3 py-1 hover:bg-slate-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
