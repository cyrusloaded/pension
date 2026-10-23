import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlacementActions } from "./PlacementActions";

export default async function PlacementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.PLACEMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ)
  ) {
    redirect("/unauthorized");
  }

  const canManage =
    hasPermission(session, PERMISSIONS.PLACEMENTS_MANAGE) ||
    hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE);

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || "25", 10)));
  const q = params.q?.trim() || "";
  const statusFilter = params.status || "";

  const openWhere: Record<string, unknown> = {
    status: statusFilter
      ? statusFilter
      : { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
  };
  if (q) {
    openWhere.pensioner = {
      OR: [
        { pensionerNumber: { contains: q, mode: "insensitive" } },
        {
          employee: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ],
    };
  }

  const [pending, totalOpen, historical, totalHist] = await Promise.all([
    prisma.placementRecord.findMany({
      where: openWhere,
      include: {
        pensioner: {
          select: {
            id: true,
            pensionerNumber: true,
            placementStatus: true,
            paymentStatus: true,
            retirementDate: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { placementDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.placementRecord.count({ where: openWhere }),
    prisma.placementRecord.findMany({
      where: { status: { in: ["ACTIVATED", "REJECTED", "WITHDRAWN"] } },
      include: {
        pensioner: {
          select: {
            pensionerNumber: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { placementDate: "desc" },
      take: 20,
    }),
    prisma.placementRecord.count({
      where: { status: { in: ["ACTIVATED", "REJECTED", "WITHDRAWN"] } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalOpen / pageSize));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New placements</h1>
        <p className="mt-1 text-sm text-slate-600">
          Retired persons awaiting activation on the pension payroll. Historical
          placement rows are retained after activation (BR-03).
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search pension no / name"
          className="rounded-md border px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Open statuses</option>
          <option value="PENDING">Pending</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="APPROVED">Approved</option>
        </select>
        <select
          name="pageSize"
          defaultValue={String(pageSize)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white"
        >
          Filter
        </button>
        <Link
          href="/admin/intake"
          className="rounded-md border px-3 py-2 text-sm"
        >
          Register retired / deceased
        </Link>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Awaiting activation ({totalOpen})
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Pensioner</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Placement date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Requirements</th>
                {canManage && (
                  <th className="px-3 py-2 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const name = r.pensioner.employee
                  ? `${r.pensioner.employee.firstName} ${r.pensioner.employee.lastName}`
                  : "";
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/pensioners/${r.pensioner.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.pensioner.pensionerNumber}
                      </Link>
                      <div className="text-xs text-slate-500">{name}</div>
                    </td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{formatDate(r.placementDate)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.outstandingRequirements || "—"}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        <PlacementActions id={r.id} />
                      </td>
                    )}
                  </tr>
                );
              })}
              {pending.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    No open placement cases.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Link
              className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
              href={`/admin/placements?page=1&pageSize=${pageSize}&q=${encodeURIComponent(q)}&status=${statusFilter}`}
            >
              First
            </Link>
            <Link
              className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
              href={`/admin/placements?page=${page - 1}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&status=${statusFilter}`}
            >
              Prev
            </Link>
            <Link
              className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
              href={`/admin/placements?page=${page + 1}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&status=${statusFilter}`}
            >
              Next
            </Link>
            <Link
              className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
              href={`/admin/placements?page=${totalPages}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&status=${statusFilter}`}
            >
              Last
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Historical placements ({totalHist})
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Pensioner</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Placement</th>
                <th className="px-3 py-2">Activated</th>
              </tr>
            </thead>
            <tbody>
              {historical.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {r.pensioner.pensionerNumber}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">{formatDate(r.placementDate)}</td>
                  <td className="px-3 py-2">
                    {r.activationDate ? formatDate(r.activationDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
