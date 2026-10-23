"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface RowResult {
  row: number;
  staffNumber: string;
  status: string;
  message?: string;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? "";
    });
    return obj;
  });
}

export function BulkImportForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{
    total: number;
    created: number;
    skippedDuplicates: number;
    errors: number;
    results: RowResult[];
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSummary(null);
    setLoading(true);

    try {
      let rows: Record<string, string>[];
      const trimmed = text.trim();
      if (trimmed.startsWith("[")) {
        rows = JSON.parse(trimmed);
      } else {
        rows = parseCsv(trimmed);
      }
      if (!rows.length) {
        setError("No data rows found");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        setLoading(false);
        return;
      }
      setSummary(data);
    } catch {
      setError("Invalid input or network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="payload" className="block text-sm font-medium text-slate-700">
          CSV or JSON rows
        </label>
        <textarea
          id="payload"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={`staffNumber,firstName,lastName,dateOfBirth,organizationCode\nKG/001/2020,Ada,Okoro,1980-05-12,MOE`}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Importing..." : "Run import"}
      </button>

      {summary && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm text-slate-700">
            Total <strong>{summary.total}</strong> · Created{" "}
            <strong className="text-green-700">{summary.created}</strong> · Duplicates
            skipped <strong className="text-amber-700">{summary.skippedDuplicates}</strong> ·
            Errors <strong className="text-red-700">{summary.errors}</strong>
          </p>
          <div className="max-h-64 overflow-auto rounded border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Row</th>
                  <th className="px-2 py-1 text-left">Staff</th>
                  <th className="px-2 py-1 text-left">Status</th>
                  <th className="px-2 py-1 text-left">Message</th>
                </tr>
              </thead>
              <tbody>
                {summary.results.map((r) => (
                  <tr key={`${r.row}-${r.staffNumber}`} className="border-t border-border">
                    <td className="px-2 py-1">{r.row}</td>
                    <td className="px-2 py-1 font-mono">{r.staffNumber}</td>
                    <td className="px-2 py-1">{r.status}</td>
                    <td className="px-2 py-1 text-slate-600">{r.message || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </form>
  );
}
