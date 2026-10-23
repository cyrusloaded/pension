"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function BenefitDecisionForm({
  assessmentId,
  canSubmit,
  canReturn,
  canApprove,
  canReject,
}: {
  assessmentId: string;
  canSubmit: boolean;
  canReturn: boolean;
  canApprove: boolean;
  canReject: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState("");

  async function runAction(action: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/benefits/${assessmentId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comments: comments || null }),
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
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="comments" className="block text-sm font-medium text-slate-700">
          Comments
        </label>
        <textarea
          id="comments"
          rows={2}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Optional notes for the audit trail"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("SUBMIT")}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit for review
          </button>
        )}
        {canReturn && (
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("RETURN")}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Return for correction
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("APPROVE")}
            className="rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            Approve
          </button>
        )}
        {canReject && (
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("REJECT")}
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
