"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Emp {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
}

interface Scheme {
  id: string;
  name: string;
  code: string;
}

export function CreateRetirementForm({
  employees,
  schemes,
}: {
  employees: Emp[];
  schemes: Scheme[];
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
      employeeId: fd.get("employeeId") as string,
      pensionSchemeId: (fd.get("pensionSchemeId") as string) || null,
      retirementCategory: (fd.get("retirementCategory") as string) || null,
      expectedRetirementDate: (fd.get("expectedRetirementDate") as string) || null,
      notes: (fd.get("notes") as string) || null,
    };

    try {
      const res = await fetch("/api/retirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create case");
        setLoading(false);
        return;
      }
      router.push(`/admin/retirements/${data.id}`);
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
      <div>
        <label htmlFor="employeeId" className="block text-sm font-medium text-slate-700">Employee *</label>
        <select id="employeeId" name="employeeId" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Select employee</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.lastName}, {e.firstName} ({e.staffNumber})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pensionSchemeId" className="block text-sm font-medium text-slate-700">Pension scheme</label>
        <select id="pensionSchemeId" name="pensionSchemeId" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">— (use employee default)</option>
          {schemes.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="retirementCategory" className="block text-sm font-medium text-slate-700">Category</label>
        <select id="retirementCategory" name="retirementCategory" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">—</option>
          <option value="COMPULSORY">Compulsory</option>
          <option value="VOLUNTARY">Voluntary</option>
          <option value="MEDICAL">Medical</option>
          <option value="STATUTORY">Statutory age</option>
        </select>
      </div>
      <div>
        <label htmlFor="expectedRetirementDate" className="block text-sm font-medium text-slate-700">Expected retirement date</label>
        <input id="expectedRetirementDate" name="expectedRetirementDate" type="date" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">Notes</label>
        <input id="notes" name="notes" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating..." : "Create case"}
        </button>
      </div>
    </form>
  );
}
