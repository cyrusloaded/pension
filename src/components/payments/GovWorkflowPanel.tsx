"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  "PREPARATION",
  "INTERNAL_AUDIT",
  "DG_APPROVAL",
  "DFA_PAYMENT",
  "COMPLETED",
] as const;

const NEXT: Record<string, string> = {
  PREPARATION: "INTERNAL_AUDIT",
  INTERNAL_AUDIT: "DG_APPROVAL",
  DG_APPROVAL: "DFA_PAYMENT",
  DFA_PAYMENT: "COMPLETED",
};

export function GovWorkflowPanel({
  scheduleId,
  workflowStage,
}: {
  scheduleId: string;
  workflowStage: string;
}) {
  const router = useRouter();
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = NEXT[workflowStage];

  async function advance(toStage: string, decision?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${scheduleId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage, decision, remarks: remarks || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Workflow update failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Government approval workflow
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Prepare → Internal Audit → DG Approval → DFA Payment (separation of duties enforced)
      </p>
      <ol className="mt-4 flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              s === workflowStage
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {s.replace(/_/g, " ")}
          </li>
        ))}
      </ol>
      <textarea
        className="mt-4 w-full rounded-md border border-border px-3 py-2 text-sm"
        rows={2}
        placeholder="Remarks (audit / DG / DFA)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              advance(
                next,
                next === "DG_APPROVAL"
                  ? "RECOMMEND_APPROVE"
                  : next === "DFA_PAYMENT"
                    ? "APPROVED"
                    : undefined
              )
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Advance to {next.replace(/_/g, " ")}
          </button>
        )}
        {workflowStage !== "COMPLETED" && workflowStage !== "REJECTED" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => advance("RETURNED", "RETURN")}
              className="rounded-md border border-border bg-white px-4 py-2 text-sm"
            >
              Return for correction
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => advance("REJECTED", "REJECTED")}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
