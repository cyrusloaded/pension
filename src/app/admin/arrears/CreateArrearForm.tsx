"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Pen {
  id: string;
  pensionerNumber: string;
  monthlyPension: unknown;
  employee: { firstName: string; lastName: string } | null;
}

export function CreateArrearForm({ pensioners }: { pensioners: Pen[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      pensionerId: fd.get("pensionerId") as string,
      periodFrom: fd.get("periodFrom") as string,
      periodTo: fd.get("periodTo") as string,
      monthsCount: Number(fd.get("monthsCount")),
      monthlyAmount: Number(fd.get("monthlyAmount")),
      reason: (fd.get("reason") as string) || null,
    };

    try {
      const res = await fetch("/api/arrears", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create arrear");
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
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-slate-700">Pensioner *</label>
        <select name="pensionerId" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="">Select</option>
          {pensioners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.pensionerNumber}
              {p.employee ? ` — ${p.employee.lastName}, ${p.employee.firstName}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Period from *</label>
        <input name="periodFrom" required placeholder="2025-10" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Period to *</label>
        <input name="periodTo" required placeholder="2025-12" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Months *</label>
        <input name="monthsCount" type="number" min={1} max={120} required defaultValue={1} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Monthly amount (₦) *</label>
        <input name="monthlyAmount" type="number" step="0.01" min="0" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Reason</label>
        <input name="reason" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create arrear
        </button>
      </div>
    </form>
  );
}
