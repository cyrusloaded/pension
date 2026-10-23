"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";

export default function ImportPaymentSchedulePage() {
  const router = useRouter();
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    rowErrors?: { row: number; pensionerNumber: string; error: string }[];
    reviewUrl?: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Select a CSV or Excel file");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("paymentPeriod", period);
      if (notes) fd.set("notes", notes);
      const res = await fetch("/api/payments/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Import failed");
        if (data.details?.rowErrors) {
          setResult({
            imported: 0,
            skipped: data.details.rowErrors.length,
            rowErrors: data.details.rowErrors,
          });
        }
        return;
      }
      setResult({
        imported: data.imported,
        skipped: data.skipped,
        rowErrors: data.rowErrors,
        reviewUrl: data.reviewUrl,
      });
      if (data.reviewUrl) {
        setTimeout(() => router.push(data.reviewUrl), 800);
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin/payment-schedules"
          className="text-sm text-primary hover:underline"
        >
          ← Payment schedules
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Import payment schedule
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Download the template, fill in pensioner numbers and amounts, then
          upload the file. You will review every line, edit or delete rows, then
          Process the schedule.
        </p>
      </div>

      {/* Template download — primary action before upload */}
      <div className="rounded-lg border-2 border-secondary/40 bg-secondary/5 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-white">
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">
                Step 1 — Download template
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                Excel or CSV with sample rows. Replace samples with your data.
                Columns: pensionerNumber, amount (required).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <a
              href="/templates/payment-schedule-import-template.xlsx"
              download="payment-schedule-import-template.xlsx"
              className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download Excel
            </a>
            <a
              href="/templates/payment-schedule-import-template.csv"
              download="payment-schedule-import-template.csv"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download CSV
            </a>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Required columns</p>
        <code className="mt-1 block text-xs">pensionerNumber, amount</code>
        <p className="mt-2 font-medium text-slate-800">Optional</p>
        <code className="mt-1 block text-xs">
          bankName, bankAccountNumber, adjustments, deductions
        </code>
        <p className="mt-2 text-xs">
          Pensioner numbers must already exist in the system. Net amount =
          amount + adjustments − deductions.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-border bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Upload className="h-5 w-5 text-primary" aria-hidden />
          Step 2 — Upload filled file
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Payment period (YYYY-MM)
          </label>
          <input
            type="month"
            required
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            File (.xlsx or .csv)
          </label>
          <input
            type="file"
            accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {result && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Imported {result.imported} row(s)
            {result.skipped ? `, skipped ${result.skipped}` : ""}.
            {result.reviewUrl && " Redirecting to review…"}
            {result.rowErrors && result.rowErrors.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-auto text-xs text-amber-800">
                {result.rowErrors.slice(0, 20).map((r) => (
                  <li key={`${r.row}-${r.pensionerNumber}`}>
                    Row {r.row}: {r.pensionerNumber} — {r.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload & open review"}
        </button>
      </form>

      <p className="text-sm text-slate-500">
        Prefer a single entry?{" "}
        <Link
          href="/admin/payment-schedules"
          className="text-primary hover:underline"
        >
          Prepare schedule from active pensioners
        </Link>
      </p>
    </div>
  );
}
