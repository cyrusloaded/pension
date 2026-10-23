"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeathReportPanel({
  pensionerId,
  currentStatus,
}: {
  pensionerId: string;
  currentStatus?: string | null;
}) {
  const router = useRouter();
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/pensioners/${pensionerId}/death`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          dateOfDeath: dateOfDeath || undefined,
          reason: reason || undefined,
          source: "OFFICER_REPORT",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(data.message);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-slate-500">
        Current death verification:{" "}
        <strong>{currentStatus || "None"}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          className="rounded border px-2 py-1"
          value={dateOfDeath}
          onChange={(e) => setDateOfDeath(e.target.value)}
        />
        <input
          className="min-w-[200px] flex-1 rounded border px-2 py-1"
          placeholder="Reason / notes"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run("REPORT")}
          className="rounded bg-amber-700 px-3 py-1.5 text-white disabled:opacity-50"
        >
          Report death
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("VERIFY")}
          className="rounded bg-slate-800 px-3 py-1.5 text-white disabled:opacity-50"
        >
          Verify death
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("DISPUTE")}
          className="rounded border px-3 py-1.5 disabled:opacity-50"
        >
          Dispute
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("REJECT")}
          className="rounded border border-red-200 px-3 py-1.5 text-red-700 disabled:opacity-50"
        >
          Reject report
        </button>
      </div>
      {msg && <p className="text-xs text-slate-700">{msg}</p>}
    </div>
  );
}
