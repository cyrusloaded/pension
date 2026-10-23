"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function BookVerificationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      verificationType: fd.get("verificationType") as string,
      scheduledDate: (fd.get("scheduledDate") as string) || null,
    };

    try {
      const res = await fetch("/api/portal/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to book verification");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      {error && (
        <div role="alert" className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700">Type *</label>
        <select name="verificationType" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="IN_PERSON">In person</option>
          <option value="DOCUMENT_REVIEW">Document review</option>
          <option value="DIGITAL">Digital</option>
          <option value="ANNUAL">Annual</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Preferred date</label>
        <input name="scheduledDate" type="date" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit request
        </button>
      </div>
    </form>
  );
}
