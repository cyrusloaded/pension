"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item = {
  id: string;
  netAmount: number;
  pensioner: { pensionerNumber: string };
};

export function ProcessClient({
  scheduleId,
  scheduleRef,
  paymentPeriod,
  status,
  totalAmount,
  items,
  existingAssessmentId,
}: {
  scheduleId: string;
  scheduleRef: string;
  paymentPeriod: string;
  status: string;
  totalAmount: number;
  items: Item[];
  existingAssessmentId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateAssessment() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${scheduleId}/assessment`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate assessment");
      router.push(data.url || `/admin/payment-assessments/${data.assessment.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/payment-schedules/${scheduleId}/review`}
          className="text-sm text-primary hover:underline"
        >
          ← Back to review
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Process schedule {scheduleRef}
        </h1>
        <p className="text-sm text-slate-600">
          Period {paymentPeriod} · {status} · {items.length} payees · ₦
          {totalAmount.toLocaleString()}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Schedule summary</h2>
        <ul className="mt-2 max-h-48 overflow-auto text-sm text-slate-600">
          {items.slice(0, 50).map((i) => (
            <li key={i.id} className="flex justify-between border-b border-slate-50 py-1">
              <span>{i.pensioner.pensionerNumber}</span>
              <span>₦{Number(i.netAmount).toLocaleString()}</span>
            </li>
          ))}
          {items.length > 50 && (
            <li className="py-1 text-xs text-slate-400">
              …and {items.length - 50} more
            </li>
          )}
        </ul>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Generate payment assessment
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          SRS: assessment and payment are allowed only after the schedule has
          passed Internal Audit and DG approval (stage must be{" "}
          <strong>DFA_PAYMENT</strong>). Use the government workflow panel on the
          schedule detail page to advance stages first.
        </p>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={generateAssessment}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {busy
              ? "Generating…"
              : existingAssessmentId
                ? "Open existing assessment"
                : "Generate assessment"}
          </button>
          {existingAssessmentId && (
            <Link
              href={`/admin/payment-assessments/${existingAssessmentId}`}
              className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View assessment
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
