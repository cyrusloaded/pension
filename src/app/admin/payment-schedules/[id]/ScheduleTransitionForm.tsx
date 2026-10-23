"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ScheduleTransitionForm({
  scheduleId,
  allowed,
}: {
  scheduleId: string;
  allowed: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      toStatus: fd.get("toStatus") as string,
      notes: (fd.get("notes") as string) || null,
    };

    try {
      const res = await fetch(`/api/payments/${scheduleId}/transition`, {
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
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
      {error && (
        <div role="alert" className="sm:col-span-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700">Next status *</label>
        <select name="toStatus" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="">Select</option>
          {allowed.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Notes</label>
        <input name="notes" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirm
        </button>
      </div>
    </form>
  );
}
