"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function RuleActionButtons({
  ruleId,
  status,
}: {
  ruleId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function act(action: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/pension-rules/${ruleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-sm text-red-700">{error}</span>}
      {status === "DRAFT" && (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => act("SUBMIT")}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            Submit for approval
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => act("APPROVE")}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
            Approve directly
          </button>
        </>
      )}
      {status === "PENDING_APPROVAL" && (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => act("APPROVE")}
            className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => act("REJECT")}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            Return to draft
          </button>
        </>
      )}
      {status === "APPROVED" && (
        <button
          type="button"
          disabled={loading}
          onClick={() => act("SUPERSEDE")}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Supersede
        </button>
      )}
    </div>
  );
}
