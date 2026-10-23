"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Sched {
  id: string;
  scheduleRef: string;
  paymentPeriod: string;
  totalAmount: unknown;
  totalItems: number;
}

export function CreateReconciliationForm({ schedules }: { schedules: Sched[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const actual = fd.get("actualAmount") as string;
    const payload = {
      scheduleId: fd.get("scheduleId") as string,
      bankReference: (fd.get("bankReference") as string) || null,
      bankDate: (fd.get("bankDate") as string) || null,
      actualAmount: actual ? Number(actual) : null,
      notes: (fd.get("notes") as string) || null,
    };

    try {
      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reconciliation failed");
        setLoading(false);
        return;
      }
      e.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {error && (
        <div role="alert" className="sm:col-span-2 lg:col-span-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {schedules.length === 0 ? (
        <p className="sm:col-span-3 text-sm text-slate-500">
          No schedules awaiting reconciliation (need SUBMITTED / PROCESSING / SUCCESSFUL without an existing reconciliation).
        </p>
      ) : (
        <>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Schedule *</label>
            <select name="scheduleId" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.scheduleRef} · {s.paymentPeriod} · {Number(s.totalAmount).toLocaleString("en-NG")} ₦ · {s.totalItems} items
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Bank reference</label>
            <input name="bankReference" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Bank date</label>
            <input name="bankDate" type="date" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Actual amount (₦)</label>
            <input name="actualAmount" type="number" step="0.01" min="0" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="Defaults to expected" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <input name="notes" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save reconciliation
            </button>
          </div>
        </>
      )}
    </form>
  );
}
