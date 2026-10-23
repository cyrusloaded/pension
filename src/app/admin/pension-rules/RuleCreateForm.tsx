"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Scheme {
  id: string;
  name: string;
  code: string;
}

export function RuleCreateForm({ schemes }: { schemes: Scheme[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const monthlyFactor = fd.get("monthlyPensionFactor") as string;
    const gratuityPerYear = fd.get("gratuityPerYearOfService") as string;
    const minYears = fd.get("eligibilityMinYears") as string;
    const method = (fd.get("calculationMethod") as string) || "PLACEHOLDER";

    const rulesJson: Record<string, unknown> = {
      calculationMethod: method,
      note:
        method === "PLACEHOLDER"
          ? "Placeholder — set official factors and change method when authorized."
          : (fd.get("note") as string) || undefined,
      eligibilityMinYears: minYears ? Number(minYears) : null,
      monthlyPensionFactor: monthlyFactor ? Number(monthlyFactor) : null,
      gratuityPerYearOfService: gratuityPerYear ? Number(gratuityPerYear) : null,
      rounding: "NEAREST_NAIRA",
    };

    const payload = {
      schemeId: fd.get("schemeId") as string,
      version: fd.get("version") as string,
      name: fd.get("name") as string,
      effectiveFrom: fd.get("effectiveFrom") as string,
      rulesJson,
    };

    try {
      const res = await fetch("/api/pension-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create rule");
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
      <div>
        <label className="block text-sm font-medium text-slate-700">Scheme *</label>
        <select name="schemeId" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          {schemes.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Version *</label>
        <input name="version" required placeholder="1.0.1" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Name *</label>
        <input name="name" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Effective from *</label>
        <input name="effectiveFrom" type="date" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Calculation method</label>
        <select name="calculationMethod" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="PLACEHOLDER">PLACEHOLDER (not for production)</option>
          <option value="FACTOR">FACTOR (configured multipliers)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Min qualifying years</label>
        <input name="eligibilityMinYears" type="number" step="0.01" min="0" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Monthly pension factor</label>
        <input name="monthlyPensionFactor" type="number" step="0.0001" min="0" max="1" placeholder="e.g. 0.5 = 50% of final salary" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Gratuity per year of service</label>
        <input name="gratuityPerYearOfService" type="number" step="0.01" min="0" placeholder="× final salary × years" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-slate-700">Policy note</label>
        <input name="note" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="Reference to circular / law" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create as DRAFT
        </button>
      </div>
    </form>
  );
}
