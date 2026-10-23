import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPensionerForUser } from "@/lib/portal/get-pensioner";
import { prisma } from "@/lib/database/prisma";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DownloadButton } from "@/components/ui/DownloadButton";

export default async function PortalDocumentsPage() {
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

  const documents = pensioner.retirementCaseId
    ? await prisma.retirementDocument.findMany({
        where: { retirementCaseId: pensioner.retirementCaseId },
        orderBy: { uploadedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          Documents associated with your retirement case. Binary files are stored
          in secure storage; metadata is shown here.
        </p>
      </div>

      {pensioner.retirementCase && (
        <p className="text-sm text-slate-600">
          Retirement case:{" "}
          <span className="font-mono font-medium">
            {pensioner.retirementCase.caseReference}
          </span>{" "}
          · stage {pensioner.retirementCase.currentStage.replace(/_/g, " ")}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-card">
        {documents.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            {pensioner.retirementCaseId
              ? "No documents registered on your retirement case yet."
              : "No retirement case is linked to your pensioner record."}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">File</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Uploaded</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">{d.documentType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.fileName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(d.uploadedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DownloadButton
                      href={`/api/documents/${d.id}/download`}
                      label="Download"
                      fileName={d.fileName}
                      variant="secondary"
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
