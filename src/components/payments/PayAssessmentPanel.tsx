"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GATEWAYS = [
  { id: "PAYSTACK", label: "Paystack" },
  { id: "FLUTTERWAVE", label: "Flutterwave" },
  { id: "INTERSWITCH", label: "Interswitch" },
  { id: "MANUAL_BANK", label: "Manual bank transfer" },
] as const;

export function PayAssessmentPanel({
  assessmentId,
  assessmentCode,
  totalAmount,
  status,
  currency = "NGN",
}: {
  assessmentId: string;
  assessmentCode: string;
  totalAmount: number;
  status: string;
  currency?: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"BANK_TRANSFER" | "GATEWAY">("GATEWAY");
  const [gateway, setGateway] = useState("PAYSTACK");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alreadyPaid = status === "PAID";

  async function pay() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/payment-assessments/${assessmentId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          gateway: method === "GATEWAY" ? gateway : "MANUAL_BANK",
          simulateSuccess: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      setMessage(
        data.message ||
          (data.paid
            ? "Payment recorded on the system"
            : "Payment initiated")
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  if (alreadyPaid) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-semibold text-emerald-900">
          Payment completed
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          This assessment ({assessmentCode}) has been paid on the system. Line
          items on the schedule are marked PAID.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Pay using assessment code
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Assessment <span className="font-mono font-semibold">{assessmentCode}</span>{" "}
        is tied to{" "}
        <span className="font-semibold">
          {currency} {totalAmount.toLocaleString()}
        </span>
        . Choose how to pay. Requires schedule stage DFA_PAYMENT (after DG approval).
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="method"
            checked={method === "BANK_TRANSFER"}
            onChange={() => setMethod("BANK_TRANSFER")}
          />
          Pay at the bank (record bank transfer)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="method"
            checked={method === "GATEWAY"}
            onChange={() => setMethod("GATEWAY")}
          />
          Pay using our gateway
        </label>

        {method === "GATEWAY" && (
          <div className="ml-6">
            <label className="block text-xs font-medium text-slate-600">
              Select gateway
            </label>
            <select
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="mt-1 rounded-md border border-border px-3 py-2 text-sm"
            >
              {GATEWAYS.filter((g) => g.id !== "MANUAL_BANK").map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Demo mode records a successful payment. Connect live API keys for
              production checkout.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={pay}
        className="mt-4 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy
          ? "Processing…"
          : method === "BANK_TRANSFER"
            ? "Record bank payment"
            : `Pay with ${gateway}`}
      </button>
    </div>
  );
}
