"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ArchiveEmployeeButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function archive() {
    if (
      !confirm(
        "Archive this employee record? The record will be excluded from active lists."
      )
    ) {
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Archived from employee detail" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Archive failed");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-1 text-xs text-red-700">{error}</p>}
      <button
        type="button"
        onClick={archive}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Archive
      </button>
    </div>
  );
}
