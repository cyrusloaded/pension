"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SubmitComplaintForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      category: fd.get("category") as string,
      subject: fd.get("subject") as string,
      description: fd.get("description") as string,
      priority: fd.get("priority") as string,
    };

    try {
      const res = await fetch("/api/portal/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed");
        setLoading(false);
        return;
      }
      setSuccess(`Complaint ${data.reference} submitted.`);
      e.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
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
      {success && (
        <div role="status" className="sm:col-span-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700">Category *</label>
        <select name="category" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="PAYMENT">Payment issue</option>
          <option value="VERIFICATION">Verification</option>
          <option value="DOCUMENT">Document</option>
          <option value="BANK">Bank details</option>
          <option value="SERVICE">General service</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Priority</label>
        <select name="priority" defaultValue="MEDIUM" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-slate-700">Subject *</label>
        <input name="subject" required maxLength={200} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-slate-700">Description *</label>
        <textarea name="description" required rows={4} minLength={10} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit complaint
        </button>
      </div>
    </form>
  );
}
