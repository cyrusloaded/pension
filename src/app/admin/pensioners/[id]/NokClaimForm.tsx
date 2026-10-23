"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NokClaimForm({ pensionerId }: { pensionerId: string }) {
  const router = useRouter();
  const [claimantName, setClaimantName] = useState("");
  const [relationship, setRelationship] = useState("NEXT_OF_KIN");
  const [amountClaimed, setAmountClaimed] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pensionerId,
          claimantName,
          relationship,
          amountClaimed: amountClaimed ? Number(amountClaimed) : null,
          claimType: "GRATUITY",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(data.message);
      setClaimantName("");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2 text-sm">
      <input
        required
        className="rounded border px-2 py-1"
        placeholder="Claimant name"
        value={claimantName}
        onChange={(e) => setClaimantName(e.target.value)}
      />
      <input
        className="rounded border px-2 py-1"
        placeholder="Relationship"
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
      />
      <input
        className="rounded border px-2 py-1"
        placeholder="Amount claimed"
        value={amountClaimed}
        onChange={(e) => setAmountClaimed(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-primary px-3 py-1.5 text-white disabled:opacity-50"
      >
        Submit claim
      </button>
      {msg && <span className="w-full text-xs text-slate-600">{msg}</span>}
    </form>
  );
}
