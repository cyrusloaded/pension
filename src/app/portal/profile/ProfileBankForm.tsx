"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ProfileBankForm({
  pensionerId,
  defaults,
}: {
  pensionerId: string;
  defaults: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  };
}) {
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
      bankName: fd.get("bankName") as string,
      bankAccountNumber: fd.get("bankAccountNumber") as string,
      bankAccountName: fd.get("bankAccountName") as string,
    };

    try {
      const res = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        setLoading(false);
        return;
      }
      setSuccess(
        "Bank details updated. Changes may require verification before the next payment run."
      );
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3 border-t border-border pt-4">
      <p className="sm:col-span-3 text-xs text-slate-500">
        Request a bank detail update (pensioner ID {pensionerId.slice(0, 8)}…)
      </p>
      {error && (
        <div role="alert" className="sm:col-span-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="sm:col-span-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600">Bank name *</label>
        <input
          name="bankName"
          required
          defaultValue={defaults.bankName}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Account number *</label>
        <input
          name="bankAccountNumber"
          required
          defaultValue={defaults.bankAccountNumber}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Account name *</label>
        <input
          name="bankAccountName"
          required
          defaultValue={defaults.bankAccountName}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save bank details
        </button>
      </div>
    </form>
  );
}
