"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Claim = {
  id: string;
  reference: string;
  claimantName: string;
  relationship: string;
  claimType: string;
  status: string;
  amountClaimed: string | number | null;
  pensioner: {
    pensionerNumber: string;
    employee: { firstName: string; lastName: string } | null;
  };
};

export default function BeneficiariesPage() {
  const [items, setItems] = useState<Claim[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (status) p.set("status", status);
      const res = await fetch(`/api/beneficiaries?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function setClaimStatus(id: string, next: string) {
    const res = await fetch(`/api/beneficiaries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Next-of-kin / beneficiary claims
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Claims link to an existing pensioner profile. Submission does not
          authorize payment (BR-09). Ordinary monthly pension of a deceased
          person remains blocked.
        </p>
      </div>

      <div className="flex gap-2">
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Pensioner</th>
              <th className="px-3 py-2">Claimant</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{c.reference}</td>
                <td className="px-3 py-2">
                  <div>{c.pensioner.pensionerNumber}</div>
                  <div className="text-xs text-slate-500">
                    {c.pensioner.employee
                      ? `${c.pensioner.employee.firstName} ${c.pensioner.employee.lastName}`
                      : ""}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {c.claimantName}
                  <div className="text-xs text-slate-500">{c.relationship}</div>
                </td>
                <td className="px-3 py-2">{c.claimType}</td>
                <td className="px-3 py-2">{c.status}</td>
                <td className="px-3 py-2 text-right text-xs space-x-2">
                  {c.status === "SUBMITTED" && (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setClaimStatus(c.id, "UNDER_REVIEW")}
                    >
                      Review
                    </button>
                  )}
                  {(c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") && (
                    <>
                      <button
                        type="button"
                        className="text-emerald-700 hover:underline"
                        onClick={() => setClaimStatus(c.id, "APPROVED")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => setClaimStatus(c.id, "REJECTED")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {c.status === "APPROVED" && (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setClaimStatus(c.id, "PAID")}
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No claims yet. Create via API or pensioner profile.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-sm">
        <span>
          {total} claim(s) · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded border px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
