"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { stageLabel } from "@/lib/workflows/retirement";

export function TransitionForm({
  caseId,
  allowedStages,
}: {
  caseId: string;
  allowedStages: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      toStage: fd.get("toStage") as string,
      comments: (fd.get("comments") as string) || null,
      reason: (fd.get("reason") as string) || null,
    };

    try {
      const res = await fetch(`/api/retirements/${caseId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Transition failed");
        setLoading(false);
        return;
      }
      setSuccess(`Moved to ${stageLabel(data.currentStage)}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {error && (
        <div role="alert" className="sm:col-span-2 lg:col-span-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="sm:col-span-2 lg:col-span-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}
      <div>
        <label htmlFor="toStage" className="block text-sm font-medium text-slate-700">
          Next stage *
        </label>
        <select
          id="toStage"
          name="toStage"
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select stage</option>
          {allowedStages.map((s) => (
            <option key={s} value={s}>
              {stageLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="comments" className="block text-sm font-medium text-slate-700">
          Comments
        </label>
        <input
          id="comments"
          name="comments"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Optional notes for the timeline"
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Updating..." : "Confirm transition"}
        </button>
      </div>
    </form>
  );
}
