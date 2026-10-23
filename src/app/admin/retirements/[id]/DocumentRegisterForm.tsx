"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { REQUIRED_DOCUMENTS } from "@/lib/workflows/retirement";
import {
  validateUploadMeta,
  MAX_UPLOAD_LABEL,
  ALLOWED_EXTENSIONS,
  acceptAttribute,
} from "@/lib/storage/validate-upload";

export function DocumentRegisterForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");

    try {
      if (file instanceof File && file.size > 0) {
        const clientCheck = validateUploadMeta({
          fileName: file.name,
          size: file.size,
          mimeType: file.type,
        });
        if (!clientCheck.ok) {
          setError(clientCheck.error || "Invalid file");
          setLoading(false);
          return;
        }

        const uploadFd = new FormData();
        uploadFd.set("file", file);
        uploadFd.set("retirementCaseId", caseId);
        uploadFd.set("documentType", fd.get("documentType") as string);
        if (fd.get("remarks")) {
          uploadFd.set("remarks", fd.get("remarks") as string);
        }

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: uploadFd,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Upload failed");
          setLoading(false);
          return;
        }
      } else {
        const payload = {
          documentType: fd.get("documentType") as string,
          fileName: (fd.get("fileName") as string) || "metadata-only",
          filePath: (fd.get("filePath") as string) || "pending",
          remarks: (fd.get("remarks") as string) || null,
        };
        const res = await fetch(`/api/retirements/${caseId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to register document");
          setLoading(false);
          return;
        }
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const f = e.target.files?.[0];
    if (!f) return;
    const check = validateUploadMeta({
      fileName: f.name,
      size: f.size,
      mimeType: f.type,
    });
    if (!check.ok) {
      setError(check.error || "Invalid file");
      e.target.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {error && (
        <div
          role="alert"
          className="sm:col-span-2 lg:col-span-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Document type *
        </label>
        <select
          name="documentType"
          required
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
        >
          {REQUIRED_DOCUMENTS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.label}
            </option>
          ))}
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Upload file
        </label>
        <input
          name="file"
          type="file"
          accept={acceptAttribute()}
          onChange={onFileChange}
          className="mt-1 w-full text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          {ALLOWED_EXTENSIONS.join(", ")} · max {MAX_UPLOAD_LABEL}
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Or storage path
        </label>
        <input
          name="filePath"
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
          placeholder="docs/ret/..."
        />
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600">
            Remarks
          </label>
          <input
            name="remarks"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add
        </button>
      </div>
      <input type="hidden" name="fileName" value="" />
    </form>
  );
}
