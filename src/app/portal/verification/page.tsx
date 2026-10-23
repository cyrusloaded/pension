import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { prisma } from "@/lib/database/prisma";
import { formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BookVerificationForm } from "./BookVerificationForm";

export default async function PortalVerificationPage() {
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

  const cases = await prisma.verificationCase.findMany({
    where: { pensionerId: pensioner.id },
    include: { evidence: true },
    orderBy: { createdAt: "desc" },
  });

  const hasOpen = cases.some((c) =>
    ["PENDING", "IN_PROGRESS", "MORE_INFO"].includes(c.status)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Verification</h1>
        <p className="mt-1 text-sm text-slate-600">
          Book or track life/identity verification required to keep payments
          active. Current status:{" "}
          <StatusBadge status={pensioner.verificationStatus} />
        </p>
      </div>

      {!hasOpen && (
        <div className="rounded-lg border border-border bg-white p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Request verification
          </h2>
          <BookVerificationForm />
        </div>
      )}

      {hasOpen && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          You already have an open verification request. Wait for it to be
          completed before booking another.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {cases.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No verification cases yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {cases.map((c) => (
              <li key={c.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium">
                    {c.reference}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {c.verificationType.replace(/_/g, " ")} · Scheduled{" "}
                  {formatDate(c.scheduledDate)}
                </p>
                {c.decisionReason && (
                  <p className="mt-1 text-sm text-slate-700">{c.decisionReason}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Created {formatDateTime(c.createdAt)}
                  {c.decidedAt && ` · Decided ${formatDateTime(c.decidedAt)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
