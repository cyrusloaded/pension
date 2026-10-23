"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ComplaintActions({
  complaintId,
  currentStatus,
}: {
  complaintId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState("");

  async function update(status: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          resolution: resolution || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
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
    <div className="space-y-2">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <textarea
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        rows={2}
        placeholder="Resolution / notes for the pensioner"
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {currentStatus === "OPEN" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => update("ASSIGNED")}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            Assign to me
          </button>
        )}
        {["OPEN", "ASSIGNED"].includes(currentStatus) && (
          <button
            type="button"
            disabled={loading}
            onClick={() => update("IN_PROGRESS")}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            In progress
          </button>
        )}
        {!["RESOLVED", "CLOSED"].includes(currentStatus) && (
          <button
            type="button"
            disabled={loading}
            onClick={() => update("RESOLVED")}
            className="inline-flex items-center gap-1 rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Resolve
          </button>
        )}
        {currentStatus === "RESOLVED" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => update("CLOSED")}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
