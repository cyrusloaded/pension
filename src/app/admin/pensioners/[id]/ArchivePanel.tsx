"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchivePanel({ pensionerId }: { pensionerId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function archive() {
    if (!confirm("Archive this pensioner? Payment history will be retained.")) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/pensioners/${pensionerId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason || "Archived by administrator",
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
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <input
        className="min-w-[220px] flex-1 rounded border px-2 py-1.5"
        placeholder="Reason for archive (required for audit)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={archive}
        className="rounded border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-800 disabled:opacity-50"
      >
        {busy ? "Archiving…" : "Archive record"}
      </button>
      {msg && <span className="w-full text-xs text-slate-600">{msg}</span>}
    </div>
  );
}
