"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function CalculateForm({
  assessmentId,
  defaultYears,
  defaultSalary,
  ruleVersionId,
}: {
  assessmentId: string;
  defaultYears?: number;
  defaultSalary?: number;
  ruleVersionId?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      qualifyingServiceYears: Number(fd.get("qualifyingServiceYears")),
      finalSalary: Number(fd.get("finalSalary")),
      ruleVersionId: ruleVersionId || null,
    };

    try {
      const res = await fetch(`/api/benefits/${assessmentId}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Calculation failed");
        setLoading(false);
        return;
      }
      const calc = data.calculation;
      if (calc && !calc.productionReady) {
        setInfo(
          "Calculation stored, but official rules are not fully configured — not production-ready."
        );
      } else {
        setInfo("Calculation updated successfully.");
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
      {info && (
        <div role="status" className="sm:col-span-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {info}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Qualifying service (years) *
        </label>
        <input
          name="qualifyingServiceYears"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaultYears}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Final salary (₦) *
        </label>
        <input
          name="finalSalary"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaultSalary}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Calculate
        </button>
      </div>
    </form>
  );
}
