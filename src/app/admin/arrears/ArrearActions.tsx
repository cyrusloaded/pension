"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ArrearActions({
  arrearId,
  status,
  canAuthorize,
}: {
  arrearId: string;
  status: string;
  canAuthorize: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function act(action: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/arrears/${arrearId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {status === "OPEN" && canAuthorize && (
        <button
          type="button"
          disabled={loading}
          onClick={() => act("APPROVE")}
          className="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
        </button>
      )}
      {["OPEN", "APPROVED", "SCHEDULED"].includes(status) && canAuthorize && (
        <button
          type="button"
          disabled={loading}
          onClick={() => act("MARK_PAID")}
          className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          Paid
        </button>
      )}
      {status === "OPEN" && (
        <button
          type="button"
          disabled={loading}
          onClick={() => act("CANCEL")}
          className="rounded border border-border px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
