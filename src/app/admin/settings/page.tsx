import { redirect } from "next/navigation";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { prisma } from "@/lib/database/prisma";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !hasPermission(session, PERMISSIONS.SETTINGS_MANAGE) &&
    !session.roles.includes("SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  const [schemes, roles, orgs] = await Promise.all([
    prisma.pensionScheme.count(),
    prisma.role.count(),
    prisma.organization.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          System configuration overview. Pension rule versions are managed under
          Pension Rules.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Active organizations" value={String(orgs)} />
        <Card label="Pension schemes" value={String(schemes)} />
        <Card label="Roles defined" value={String(roles)} />
      </div>

      <section className="rounded-lg border border-border bg-white p-5 shadow-card text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">Production checklist</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Set strong <code className="text-xs">SESSION_SECRET</code> and database credentials in environment</li>
          <li>Run PostgreSQL with automated backups and restricted network access</li>
          <li>Approve official pension rule versions before production awards</li>
          <li>Enable HTTPS at the reverse proxy; cookies are secure in production mode</li>
          <li>Monitor <code className="text-xs">/api/health</code> for readiness</li>
          <li>Set <code className="text-xs">STORAGE_DRIVER=s3</code> and MinIO/S3 credentials for multi-node document storage</li>
          <li>Review audit logs regularly for privileged actions</li>
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
