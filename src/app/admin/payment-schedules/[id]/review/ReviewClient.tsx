"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item = {
  id: string;
  amount: number;
  adjustments: number;
  deductions: number;
  netAmount: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  status: string;
  pensioner: {
    pensionerNumber: string;
    employee?: { firstName: string; lastName: string } | null;
  };
};

export function ReviewClient({
  scheduleId,
  scheduleRef,
  paymentPeriod,
  status,
  initialItems,
  totalAmount,
}: {
  scheduleId: string;
  scheduleRef: string;
  paymentPeriod: string;
  status: string;
  initialItems: Item[];
  totalAmount: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Item>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable = ["DRAFT", "PENDING_REVIEW"].includes(status);

  function startEdit(item: Item) {
    setEditingId(item.id);
    setDraft({
      amount: item.amount,
      adjustments: item.adjustments,
      deductions: item.deductions,
      bankName: item.bankName,
      bankAccountNumber: item.bankAccountNumber,
    });
  }

  async function saveRow(itemId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${scheduleId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage("Row saved");
      setEditingId(null);
      router.refresh();
      // optimistic local update
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const amount = Number(draft.amount ?? it.amount);
          const adjustments = Number(draft.adjustments ?? it.adjustments ?? 0);
          const deductions = Number(draft.deductions ?? it.deductions ?? 0);
          return {
            ...it,
            amount,
            adjustments,
            deductions,
            netAmount: amount + adjustments - deductions,
            bankName: (draft.bankName as string) ?? it.bankName,
            bankAccountNumber:
              (draft.bankAccountNumber as string) ?? it.bankAccountNumber,
          };
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(itemId: string) {
    if (!confirm("Delete this line from the schedule?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${scheduleId}/items/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setMessage("Row deleted");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function processSchedule() {
    if (!confirm("Process this schedule and continue to assessment?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${scheduleId}/process`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Process failed");
      router.push(data.processUrl || `/admin/payment-schedules/${scheduleId}/process`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Process failed");
      setBusy(false);
    }
  }

  async function deleteSchedule() {
    if (!confirm("Delete the entire uploaded schedule and all rows?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/${scheduleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      router.push("/admin/payment-schedules");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  const sum = items.reduce((s, i) => s + Number(i.netAmount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/payment-schedules" className="text-sm text-primary hover:underline">
            ← Schedules
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Review schedule {scheduleRef}
          </h1>
          <p className="text-sm text-slate-600">
            Period {paymentPeriod} · Status {status} · {items.length} line(s) · ₦
            {sum.toLocaleString()}
          </p>
        </div>
      </div>

      {message && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Pensioner</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Adj.</th>
              <th className="px-3 py-2">Ded.</th>
              <th className="px-3 py-2">Net</th>
              <th className="px-3 py-2">Bank</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const name = item.pensioner.employee
                ? `${item.pensioner.employee.firstName} ${item.pensioner.employee.lastName}`
                : "";
              const isEdit = editingId === item.id;
              return (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.pensioner.pensionerNumber}</div>
                    <div className="text-xs text-slate-500">{name}</div>
                  </td>
                  <td className="px-3 py-2">
                    {isEdit ? (
                      <input
                        type="number"
                        className="w-24 rounded border px-1 py-0.5"
                        value={draft.amount as number}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, amount: Number(e.target.value) }))
                        }
                      />
                    ) : (
                      Number(item.amount).toLocaleString()
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit ? (
                      <input
                        type="number"
                        className="w-20 rounded border px-1 py-0.5"
                        value={draft.adjustments as number}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            adjustments: Number(e.target.value),
                          }))
                        }
                      />
                    ) : (
                      Number(item.adjustments ?? 0).toLocaleString()
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit ? (
                      <input
                        type="number"
                        className="w-20 rounded border px-1 py-0.5"
                        value={draft.deductions as number}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            deductions: Number(e.target.value),
                          }))
                        }
                      />
                    ) : (
                      Number(item.deductions ?? 0).toLocaleString()
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    ₦{Number(item.netAmount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit ? (
                      <input
                        className="w-28 rounded border px-1 py-0.5"
                        value={(draft.bankName as string) ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, bankName: e.target.value }))
                        }
                      />
                    ) : (
                      item.bankName || "—"
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {isEdit ? (
                      <input
                        className="w-28 rounded border px-1 py-0.5"
                        value={(draft.bankAccountNumber as string) ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            bankAccountNumber: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      item.bankAccountNumber || "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {editable &&
                      (isEdit ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => saveRow(item.id)}
                            className="mr-2 text-xs font-medium text-emerald-700 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="mr-2 text-xs font-medium text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => deleteRow(item.id)}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </>
                      ))}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No lines left on this schedule.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled={busy || items.length === 0 || !editable}
          onClick={processSchedule}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          Process schedule
        </button>
        <button
          type="button"
          disabled={busy || !editable}
          onClick={deleteSchedule}
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete schedule
        </button>
        <p className="self-center text-xs text-slate-500">
          Process opens assessment generation. Delete removes the whole import.
        </p>
      </div>
    </div>
  );
}
