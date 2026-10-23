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

interface Pen {
  id: string;
  pensionerNumber: string;
  employee: { firstName: string; lastName: string } | null;
}

export function CreateVerificationForm({
  employees,
  pensioners,
}: {
  employees: Emp[];
  pensioners: Pen[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subjectType, setSubjectType] = useState<"employee" | "pensioner">("employee");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      employeeId: subjectType === "employee" ? (fd.get("employeeId") as string) || null : null,
      pensionerId: subjectType === "pensioner" ? (fd.get("pensionerId") as string) || null : null,
      verificationType: fd.get("verificationType") as string,
      scheduledDate: (fd.get("scheduledDate") as string) || null,
    };

    try {
      const res = await fetch("/api/verification", {
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
      router.push(`/admin/verification/${data.id}`);
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
        <label className="block text-sm font-medium text-slate-700">Subject type</label>
        <select
          value={subjectType}
          onChange={(e) => setSubjectType(e.target.value as "employee" | "pensioner")}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="employee">Employee</option>
          <option value="pensioner">Pensioner</option>
        </select>
      </div>
      {subjectType === "employee" ? (
        <div>
          <label htmlFor="employeeId" className="block text-sm font-medium text-slate-700">Employee *</label>
          <select id="employeeId" name="employeeId" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
            <option value="">Select</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName}, {e.firstName} ({e.staffNumber})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="pensionerId" className="block text-sm font-medium text-slate-700">Pensioner *</label>
          <select id="pensionerId" name="pensionerId" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
            <option value="">Select</option>
            {pensioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.pensionerNumber}
                {p.employee ? ` — ${p.employee.lastName}, ${p.employee.firstName}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="verificationType" className="block text-sm font-medium text-slate-700">Type *</label>
        <select id="verificationType" name="verificationType" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="IN_PERSON">In person</option>
          <option value="DOCUMENT_REVIEW">Document review</option>
          <option value="DIGITAL">Digital</option>
          <option value="FIELD">Field</option>
          <option value="ANNUAL">Annual</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="scheduledDate" className="block text-sm font-medium text-slate-700">Scheduled date</label>
        <input id="scheduledDate" name="scheduledDate" type="date" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating..." : "Create verification case"}
        </button>
      </div>
    </form>
  );
}
