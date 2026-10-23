import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { PortalSidebar } from "@/components/layout/PortalSidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Staff with non-pensioner roles should use admin, unless they also have PENSIONER
  const isPensionerRole = session.roles.includes("PENSIONER");
  if (!isPensionerRole) {
    // Allow staff to view portal only if linked as pensioner? Prefer admin for officers.
    redirect("/admin/dashboard");
  }

  const pensioner = await getPensionerForUser(session);
  const userName = `${session.firstName} ${session.lastName}`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <PortalSidebar
        userName={userName}
        pensionerNumber={pensioner?.pensionerNumber}
      />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-white px-4 shadow-sm lg:px-6">
          <div className="ml-12 flex-1 lg:ml-0">
            <p className="text-sm text-slate-500">
              Kogi State Civil Service Pension — Pensioner Self-Service
            </p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
