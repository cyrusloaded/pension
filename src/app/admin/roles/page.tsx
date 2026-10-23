import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";

export default async function RolesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, PERMISSIONS.ROLES_MANAGE) && !hasPermission(session, PERMISSIONS.USERS_MANAGE)) {
    redirect("/unauthorized");
  }

  const roles = await prisma.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-slate-600">
          System roles and assigned permissions. Role definitions are managed by Super Administrators.
        </p>
      </div>
      <div className="grid gap-4">
        {roles.map((role) => (
          <div key={role.id} className="rounded-lg border border-border bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{role.name}</h2>
                <p className="text-xs text-slate-500 font-mono">{role.code}</p>
              </div>
              <p className="text-sm text-slate-600">{role._count.users} user(s)</p>
            </div>
            {role.description && (
              <p className="mt-2 text-sm text-slate-600">{role.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {role.permissions.length === 0 ? (
                <span className="text-xs text-slate-400">No permissions assigned</span>
              ) : (
                role.permissions.map((rp) => (
                  <span
                    key={rp.permission.id}
                    className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {rp.permission.code}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

