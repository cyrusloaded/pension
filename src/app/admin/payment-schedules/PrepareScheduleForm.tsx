"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function PrepareScheduleForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      paymentPeriod: fd.get("paymentPeriod") as string,
      notes: (fd.get("notes") as string) || null,
    };

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to prepare schedule");
        setLoading(false);
        return;
      }
      router.push(`/admin/payment-schedules/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  // Default to current month YYYY-MM
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      {error && (
        <div role="alert" className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="paymentPeriod" className="block text-sm font-medium text-slate-700">
          Payment period (YYYY-MM) *
        </label>
        <input
          id="paymentPeriod"
          name="paymentPeriod"
          required
          pattern="\d{4}-\d{2}"
          defaultValue={defaultPeriod}
          placeholder="2026-01"
          className="mt-1 w-40 rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="min-w-[200px] flex-1">
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <input
          id="notes"
          name="notes"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Preparing..." : "Prepare schedule"}
      </button>
    </form>
  );
}
