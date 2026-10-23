import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { prisma } from "@/lib/database/prisma";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitComplaintForm } from "./SubmitComplaintForm";

export default async function PortalComplaintsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pensioner = await getPensionerForUser(session);
  if (!pensioner) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        No pensioner record linked.
      </div>
    );
  }

  const complaints = await prisma.complaint.findMany({
    where: { pensionerId: pensioner.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Complaints</h1>
        <p className="mt-1 text-sm text-slate-600">
          Submit and track service complaints. You will receive updates when
          officers respond.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          New complaint
        </h2>
        <SubmitComplaintForm />
      </div>

      <div className="space-y-3">
        {complaints.length === 0 ? (
          <div className="rounded-lg border border-border bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-card">
            You have not submitted any complaints.
          </div>
        ) : (
          complaints.map((c) => (
            <article
              key={c.id}
              className="rounded-lg border border-border bg-white p-4 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium">{c.reference}</span>
                <StatusBadge status={c.status} />
              </div>
              <h3 className="mt-2 font-semibold text-slate-900">{c.subject}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {c.category} · {c.priority} · {formatDateTime(c.createdAt)}
              </p>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                {c.description}
              </p>
              {c.resolution && (
                <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Resolution
                  </p>
                  <p className="mt-1">{c.resolution}</p>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
