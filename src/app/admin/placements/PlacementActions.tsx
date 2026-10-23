"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlacementActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/placements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => setStatus("ACTIVATED")}
        className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
      >
        Activate on payroll
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setStatus("REJECTED")}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
