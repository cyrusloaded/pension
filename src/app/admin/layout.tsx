import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Pure pensioner accounts use the self-service portal only
  if (session.roles.includes("PENSIONER") && session.roles.length === 1) {
    redirect("/portal/dashboard");
  }

  const userName = `${session.firstName} ${session.lastName}`;
  const userRole =
    session.roles.map((r) => r.replace(/_/g, " ")).join(", ") || "Officer";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar
        userName={userName}
        userRole={userRole}
        permissions={session.permissions}
        roles={session.roles}
      />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-white px-4 shadow-sm lg:px-6">
          <div className="ml-12 flex-1 lg:ml-0">
            <p className="text-sm text-slate-500">
              Kogi State Civil Service Pension Management System
            </p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
