"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface CaseOption {
  id: string;
  caseReference: string;
  employee: { staffNumber: string; firstName: string; lastName: string };
}

export function CreateAssessmentForm({ cases }: { cases: CaseOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      retirementCaseId: fd.get("retirementCaseId") as string,
      qualifyingServiceYears: fd.get("qualifyingServiceYears")
        ? Number(fd.get("qualifyingServiceYears"))
        : null,
      finalSalary: fd.get("finalSalary") ? Number(fd.get("finalSalary")) : null,
    };

    try {
      const res = await fetch("/api/benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create assessment");
        setLoading(false);
        return;
      }
      router.push(`/admin/benefits/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error");
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
        <label htmlFor="retirementCaseId" className="block text-sm font-medium text-slate-700">
          Retirement case *
        </label>
        <select
          id="retirementCaseId"
          name="retirementCaseId"
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select case</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.caseReference} — {c.employee.lastName}, {c.employee.firstName} ({c.employee.staffNumber})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="qualifyingServiceYears" className="block text-sm font-medium text-slate-700">
          Qualifying service (years)
        </label>
        <input
          id="qualifyingServiceYears"
          name="qualifyingServiceYears"
          type="number"
          step="0.01"
          min="0"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Auto from service history if blank"
        />
      </div>
      <div>
        <label htmlFor="finalSalary" className="block text-sm font-medium text-slate-700">
          Final salary (₦)
        </label>
        <input
          id="finalSalary"
          name="finalSalary"
          type="number"
          step="0.01"
          min="0"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Auto from salary history if blank"
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={loading || cases.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating..." : "Create assessment"}
        </button>
        {cases.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">
            No open retirement cases in assessment-related stages.
          </p>
        )}
      </div>
    </form>
  );
}
