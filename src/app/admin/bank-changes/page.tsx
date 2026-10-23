"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  pensionerId: string;
  status: string;
  previousBankName: string | null;
  previousAccountNumber: string | null;
  newBankName: string | null;
  newAccountNumber: string | null;
  reason: string | null;
  createdAt: string;
  pensioner: {
    pensionerNumber: string;
    employee: { firstName: string; lastName: string } | null;
  } | null;
};

export default function BankChangesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("PENDING");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (status) p.set("status", status);
    const res = await fetch(`/api/bank-changes?${p}`);
    const data = await res.json();
    if (res.ok) {
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(item: Item, decision: "APPROVE" | "REJECT") {
    setMsg(null);
    const res = await fetch(`/api/pensioners/${item.pensionerId}/bank-change`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeId: item.id, decision }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }
    setMsg(`${decision} applied`);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bank detail changes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Controlled changes to pensioner bank details. Approval required before
          profile is updated. Financial history is preserved.
        </p>
      </div>
      <select
        className="rounded border px-3 py-2 text-sm"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
      </select>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Pensioner</th>
              <th className="px-3 py-2">Previous</th>
              <th className="px-3 py-2">New</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/pensioners/${i.pensionerId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {i.pensioner?.pensionerNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {i.previousBankName} {i.previousAccountNumber}
                </td>
                <td className="px-3 py-2 text-xs">
                  {i.newBankName} {i.newAccountNumber}
                </td>
                <td className="px-3 py-2">{i.status}</td>
                <td className="px-3 py-2 text-right text-xs space-x-2">
                  {i.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        className="text-emerald-700 hover:underline"
                        onClick={() => decide(i, "APPROVE")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => decide(i, "REJECT")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No bank change requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm">
        <span>
          Page {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded border px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            className="rounded border px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
