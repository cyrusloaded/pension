"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Org = { id: string; name: string; code: string };
type Row = {
  id: string;
  pensionerNumber: string;
  paymentStatus: string;
  placementStatus: string;
  verificationStatus: string;
  retirementDate: string | null;
  monthlyPension: string | number | null;
  employee: {
    firstName: string;
    lastName: string;
    staffNumber: string;
    jobTitle: string | null;
  } | null;
  organization: { name: string; code: string } | null;
  placementRecords: { id: string; status: string }[];
};

/**
 * Register Retired / Deceased — DB-backed list, register form, template, import.
 * Terminology: New Placement, Pensioner, Retired, Deceased (no "Employee" labels).
 */
export default function RegisterRetiredDeceasedPage() {
  const [tab, setTab] = useState<"list" | "register" | "import">("list");
  const [items, setItems] = useState<Row[]>([]);
  const [summary, setSummary] = useState({
    retired: 0,
    deceased: 0,
    openPlacements: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      const res = await fetch(`/api/intake?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((d) => {
        const list = d.items || d.organizations || [];
        setOrgs(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Register retired / deceased
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pension administration intake only. Create or import{" "}
            <strong>Retired</strong> (New Placement) and <strong>Deceased</strong>{" "}
            records with service particulars. Not for active serving staff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("register")}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            Register new record
          </button>
          <button
            type="button"
            onClick={() => setTab("import")}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium"
          >
            Import records
          </button>
          <a
            href="/api/intake/template"
            className="rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm font-medium text-secondary"
          >
            Download Excel template (.xlsx)
          </a>
          <a
            href="/api/intake/export"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Export CSV
          </a>
          <a
            href="/admin/import-history"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Import history
          </a>
          <button
            type="button"
            onClick={() => {
              setTab("list");
              load();
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Refresh list
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Retired (non-deceased)" value={summary.retired} />
        <SummaryCard label="Deceased records" value={summary.deceased} />
        <SummaryCard
          label="Open new placements"
          value={summary.openPlacements}
          href="/admin/placements"
        />
      </div>

      {tab === "list" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-md border px-3 py-2 text-sm"
              placeholder="Search name, pension no, staff no…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
            />
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="RETIRED">Retired / placement</option>
              <option value="DECEASED">Deceased</option>
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                load();
              }}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white"
            >
              Search
            </button>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Pension no</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">MDA</th>
                    <th className="px-3 py-2">Lifecycle</th>
                    <th className="px-3 py-2">Verification</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const name = r.employee
                      ? `${r.employee.firstName} ${r.employee.lastName}`
                      : "—";
                    const life =
                      r.paymentStatus === "DECEASED" ||
                      r.placementStatus === "DECEASED"
                        ? "Deceased"
                        : r.placementStatus === "NEW_PLACEMENT"
                          ? "New placement"
                          : r.placementStatus === "ACTIVE"
                            ? "Active pensioner"
                            : r.placementStatus || r.paymentStatus;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.pensionerNumber}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-slate-500">
                            {r.employee?.staffNumber}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.organization?.code || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                            {life}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.verificationStatus}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          <Link
                            href={`/admin/pensioners/${r.id}`}
                            className="text-primary hover:underline"
                          >
                            View profile
                          </Link>
                          {r.placementRecords?.[0] && (
                            <>
                              {" · "}
                              <Link
                                href="/admin/placements"
                                className="text-primary hover:underline"
                              >
                                Placement
                              </Link>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-slate-500"
                      >
                        No records. Register new or import the template.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-600">
              {total} record(s) · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "register" && (
        <RegisterForm
          orgs={orgs}
          onDone={() => {
            setTab("list");
            load();
          }}
          onCancel={() => setTab("list")}
        />
      )}

      {tab === "import" && (
        <ImportPanel
          onDone={() => {
            setTab("list");
            load();
          }}
          onCancel={() => setTab("list")}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RegisterForm({
  orgs,
  onDone,
  onCancel,
}: {
  orgs: Org[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    recordStatus: "RETIRED",
    firstName: "",
    lastName: "",
    middleName: "",
    staffNumber: "",
    pensionerNumber: "",
    organizationId: "",
    retirementDate: "",
    dateOfDeath: "",
    appointmentDate: "",
    yearsOfService: "",
    finalSalary: "",
    gradeLevel: "",
    jobTitle: "",
    monthlyPension: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    phone: "",
    historyNotes: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          yearsOfService: form.yearsOfService
            ? Number(form.yearsOfService)
            : null,
          finalSalary: form.finalSalary ? Number(form.finalSalary) : null,
          monthlyPension: form.monthlyPension
            ? Number(form.monthlyPension)
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold">Register new record</h2>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={form.recordStatus === "RETIRED"}
            onChange={() => set("recordStatus", "RETIRED")}
          />
          Retired → New placement
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={form.recordStatus === "DECEASED"}
            onChange={() => set("recordStatus", "DECEASED")}
          />
          Deceased
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name *" value={form.firstName} onChange={(v) => set("firstName", v)} required />
        <Field label="Last name *" value={form.lastName} onChange={(v) => set("lastName", v)} required />
        <div>
          <label className="text-xs font-medium text-slate-600">MDA *</label>
          <select
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={form.organizationId}
            onChange={(e) => set("organizationId", e.target.value)}
          >
            <option value="">Select</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} — {o.name}
              </option>
            ))}
          </select>
        </div>
        <Field
          label={form.recordStatus === "RETIRED" ? "Retirement date *" : "Retirement date"}
          type="date"
          value={form.retirementDate}
          onChange={(v) => set("retirementDate", v)}
          required={form.recordStatus === "RETIRED"}
        />
        {form.recordStatus === "DECEASED" && (
          <Field
            label="Date of death"
            type="date"
            value={form.dateOfDeath}
            onChange={(v) => set("dateOfDeath", v)}
          />
        )}
        <Field label="Appointment date" type="date" value={form.appointmentDate} onChange={(v) => set("appointmentDate", v)} />
        <Field label="Years of service" value={form.yearsOfService} onChange={(v) => set("yearsOfService", v)} />
        <Field label="Grade level" value={form.gradeLevel} onChange={(v) => set("gradeLevel", v)} />
        <Field label="Designation / job title" value={form.jobTitle} onChange={(v) => set("jobTitle", v)} />
        <Field label="Final salary" value={form.finalSalary} onChange={(v) => set("finalSalary", v)} />
        <Field label="Monthly pension" value={form.monthlyPension} onChange={(v) => set("monthlyPension", v)} />
        <Field label="Staff / service no" value={form.staffNumber} onChange={(v) => set("staffNumber", v)} />
        <Field label="Pension number (optional)" value={form.pensionerNumber} onChange={(v) => set("pensionerNumber", v)} />
        <Field label="Bank name" value={form.bankName} onChange={(v) => set("bankName", v)} />
        <Field label="Account number" value={form.bankAccountNumber} onChange={(v) => set("bankAccountNumber", v)} />
      </div>
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save record"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        required={required}
        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ImportPanel({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    createdCount: number;
    skippedCount: number;
    failedCount: number;
    rows?: { rowNumber: number; status: string; errorMessage?: string; pensionerNumber?: string }[];
  } | null>(null);

  const [preview, setPreview] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    wouldCreate: number;
    preview: { rowNumber: number; status: string; error?: string; firstName: string; lastName: string; recordStatus: string }[];
  } | null>(null);

  async function runPreview() {
    if (!file) {
      setError("Select a CSV file");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/intake/import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Select a CSV file");
      return;
    }
    if (!preview) {
      setError("Run Preview & validate first, then confirm import");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("mode", "CREATE_ONLY");
      const res = await fetch("/api/intake/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult({
        message: data.message,
        createdCount: data.createdCount,
        skippedCount: data.skippedCount,
        failedCount: data.failedCount,
        rows: data.rows,
      });
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Import records</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>
          <a href="/api/intake/template" className="text-primary hover:underline">
            Download template
          </a>
        </li>
        <li>Fill RETIRED or DECEASED rows (not active staff)</li>
        <li>Upload CSV and confirm — creates New Placement / Deceased only</li>
        <li>Import does not approve pension or pay anyone</li>
      </ol>
      <form onSubmit={runImport} className="space-y-3">
        <input
          type="file"
          accept=".csv,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {result && (
          <div className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <p>{result.message}</p>
            <p className="mt-1 text-xs">
              Created {result.createdCount}, skipped {result.skippedCount}, failed{" "}
              {result.failedCount}
            </p>
            {result.rows && result.rows.some((r) => r.status !== "CREATED") && (
              <ul className="mt-2 max-h-40 overflow-auto text-xs text-amber-900">
                {result.rows
                  .filter((r) => r.status !== "CREATED")
                  .slice(0, 30)
                  .map((r) => (
                    <li key={r.rowNumber}>
                      Row {r.rowNumber}: {r.status} — {r.errorMessage || r.pensionerNumber}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
        {preview && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            <p>
              Preview: {preview.totalRows} rows · valid {preview.validRows} · invalid{" "}
              {preview.invalidRows} · duplicates {preview.duplicateRows} · would create{" "}
              {preview.wouldCreate}
            </p>
            <ul className="mt-2 max-h-40 overflow-auto text-xs">
              {preview.preview.slice(0, 40).map((r) => (
                <li key={r.rowNumber}>
                  Row {r.rowNumber}: {r.status} {r.firstName} {r.lastName} ({r.recordStatus})
                  {r.error ? ` — ${r.error}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={runPreview}
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Working…" : "1. Preview & validate"}
          </button>
          <button
            type="submit"
            disabled={busy || !preview}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Processing…" : "2. Confirm import"}
          </button>
          {result && (
            <button
              type="button"
              onClick={onDone}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Back to list
            </button>
          )}
          <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
