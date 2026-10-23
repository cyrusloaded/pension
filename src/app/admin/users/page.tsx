import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserCreateForm } from "./UserCreateForm";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, PERMISSIONS.USERS_MANAGE)) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || "25", 10)));
  const q = params.q?.trim() || "";

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { staffNumber: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users, roles, organizations] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        staffNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        organization: { select: { name: true, code: true } },
        roles: {
          include: { role: { select: { code: true, name: true } } },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.role.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          System accounts and role assignments. Super Admin full CRUD with
          server-side permission checks.
        </p>
      </div>

      <UserCreateForm roles={roles} organizations={organizations} />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search email, name, staff no…"
          className="rounded-md border px-3 py-2 text-sm"
        />
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
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email / username</th>
              <th className="px-3 py-2">Org</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {u.lastName}, {u.firstName}
                  <div className="text-xs text-slate-500">{u.staffNumber}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{u.email}</div>
                  <div className="text-xs text-slate-500">{u.username}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.organization?.code || "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.roles.map((r) => r.role.code).join(", ") || "—"}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {total} user(s) · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Link
            className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/users?page=1&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}
          >
            First
          </Link>
          <Link
            className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/users?page=${page - 1}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}
          >
            Prev
          </Link>
          <Link
            className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/users?page=${page + 1}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}
          >
            Next
          </Link>
          <Link
            className={`rounded border px-2 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            href={`/admin/users?page=${totalPages}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`}
          >
            Last
          </Link>
        </div>
      </div>
    </div>
  );
}
