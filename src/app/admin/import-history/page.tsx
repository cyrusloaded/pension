"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Batch = {
  id: string;
  batchRef: string;
  module: string;
  originalFilename: string;
  status: string;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
};

export default function ImportHistoryPage() {
  const [items, setItems] = useState<Batch[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    const res = await fetch(`/api/import-batches?page=${page}&pageSize=25`);
    const data = await res.json();
    if (res.ok) {
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import history</h1>
        <p className="mt-1 text-sm text-slate-600">
          Batch log for register and other imports. Import never approves pension
          or triggers payment.
        </p>
        <Link href="/admin/intake" className="text-sm text-primary hover:underline">
          ← Register / import workspace
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Created</th>
              <th className="px-3 py-2 text-right">Failed</th>
              <th className="px-3 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{b.batchRef}</td>
                <td className="px-3 py-2">{b.originalFilename}</td>
                <td className="px-3 py-2">{b.module}</td>
                <td className="px-3 py-2">{b.status}</td>
                <td className="px-3 py-2 text-right">{b.createdCount}</td>
                <td className="px-3 py-2 text-right">{b.failedCount}</td>
                <td className="px-3 py-2 text-xs">
                  {new Date(b.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No import batches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm">
        <span>
          {total} batch(es) · page {page}/{totalPages}
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
