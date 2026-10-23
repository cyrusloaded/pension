"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SalaryHistoryForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const basic = Number(fd.get("basicSalary"));
    const allowances = fd.get("allowances")
      ? Number(fd.get("allowances"))
      : null;
    const payload = {
      gradeLevel: fd.get("gradeLevel") as string,
      step: fd.get("step") ? Number(fd.get("step")) : null,
      basicSalary: basic,
      allowances,
      totalEmolument: allowances != null ? basic + allowances : basic,
      effectiveDate: fd.get("effectiveDate") as string,
      endDate: (fd.get("endDate") as string) || null,
      remarks: (fd.get("remarks") as string) || null,
    };

    try {
      const res = await fetch(`/api/employees/${employeeId}/salary-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add entry");
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
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {error && (
        <div className="sm:col-span-2 lg:col-span-4 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600">Grade *</label>
        <input name="gradeLevel" required className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Step</label>
        <input name="step" type="number" min={0} max={20} className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Basic salary (₦) *</label>
        <input name="basicSalary" type="number" step="0.01" min="0" required className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Allowances (₦)</label>
        <input name="allowances" type="number" step="0.01" min="0" className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Effective date *</label>
        <input name="effectiveDate" type="date" required className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">End date</label>
        <input name="endDate" type="date" className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Remarks</label>
        <input name="remarks" className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add
        </button>
      </div>
    </form>
  );
}
