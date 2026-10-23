/**
 * Shared upload validation: size, extension, declared MIME, and magic-byte sniffing.
 * Server must always re-validate; client checks are UX only.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Human-readable for UI */
export const MAX_UPLOAD_LABEL = "10 MB";

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
] as const;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const EXT_TO_MIMES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip", // some browsers report docx as zip
  ],
};

export type UploadValidationErrorCode =
  | "EMPTY"
  | "TOO_LARGE"
  | "BAD_EXTENSION"
  | "BAD_MIME"
  | "MIME_EXT_MISMATCH"
  | "BAD_SIGNATURE";

export interface UploadValidationResult {
  ok: boolean;
  error?: string;
  code?: UploadValidationErrorCode;
  /** Normalized MIME to store (from signature when possible) */
  detectedMime?: string;
  extension?: string;
}

function getExtension(fileName: string): string {
  const base = fileName.trim().toLowerCase();
  const i = base.lastIndexOf(".");
  if (i < 0) return "";
  return base.slice(i);
}

/** Magic-byte detection for allowed document types */
export function detectMimeFromBuffer(data: Buffer): string | null {
  if (data.length < 4) return null;

  // PDF: %PDF
  if (
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46
  ) {
    return "application/pdf";
  }

  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return "image/png";
  }

  // WEBP: RIFF....WEBP
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return "image/webp";
  }

  // OLE Compound File (legacy .doc): D0 CF 11 E0
  if (
    data[0] === 0xd0 &&
    data[1] === 0xcf &&
    data[2] === 0x11 &&
    data[3] === 0xe0
  ) {
    return "application/msword";
  }

  // ZIP-based (docx): PK\x03\x04 — accept only when extension is .docx
  if (
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07) &&
    (data[3] === 0x04 || data[3] === 0x06 || data[3] === 0x08)
  ) {
    return "application/zip";
  }

  return null;
}

/**
 * Client-safe checks (no buffer): size, extension, declared MIME.
 */
export function validateUploadMeta(input: {
  fileName: string;
  size: number;
  mimeType?: string | null;
}): UploadValidationResult {
  const { fileName, size } = input;
  const mimeType = (input.mimeType || "").toLowerCase().trim();

  if (!fileName || size <= 0) {
    return {
      ok: false,
      code: "EMPTY",
      error: "Please select a non-empty file.",
    };
  }

  if (size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "TOO_LARGE",
      error: `File exceeds the maximum size of ${MAX_UPLOAD_LABEL}.`,
    };
  }

  const extension = getExtension(fileName);
  if (
    !extension ||
    !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])
  ) {
    return {
      ok: false,
      code: "BAD_EXTENSION",
      error: `File type not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}.`,
      extension,
    };
  }

  if (mimeType && mimeType !== "application/octet-stream") {
    const allowedForExt = EXT_TO_MIMES[extension] || [];
    const mimeOk =
      ALLOWED_MIME_TYPES.includes(
        mimeType as (typeof ALLOWED_MIME_TYPES)[number]
      ) || allowedForExt.includes(mimeType);

    if (!mimeOk) {
      return {
        ok: false,
        code: "BAD_MIME",
        error:
          "Browser-reported file type is not allowed. Use PDF, JPEG, PNG, WebP, or Word documents.",
        extension,
      };
    }

    if (
      allowedForExt.length &&
      !allowedForExt.includes(mimeType) &&
      mimeType !== "application/octet-stream"
    ) {
      // soft mismatch still blocked when clearly wrong (e.g. .pdf + image/png)
      const extMimes = EXT_TO_MIMES[extension];
      if (extMimes && !extMimes.includes(mimeType)) {
        return {
          ok: false,
          code: "MIME_EXT_MISMATCH",
          error: `File extension (${extension}) does not match the reported type (${mimeType}).`,
          extension,
        };
      }
    }
  }

  return {
    ok: true,
    extension,
    detectedMime: mimeType || EXT_TO_MIMES[extension]?.[0],
  };
}

/**
 * Full server-side validation including magic bytes.
 */
export function validateUploadBuffer(input: {
  fileName: string;
  size: number;
  mimeType?: string | null;
  data: Buffer;
}): UploadValidationResult {
  const meta = validateUploadMeta(input);
  if (!meta.ok) return meta;

  const extension = meta.extension || getExtension(input.fileName);
  const signature = detectMimeFromBuffer(input.data);

  if (!signature) {
    return {
      ok: false,
      code: "BAD_SIGNATURE",
      error:
        "File content could not be verified. The file may be corrupted or is not an allowed type.",
      extension,
    };
  }

  // Map signature → allowed extension pairs
  if (signature === "application/pdf" && extension !== ".pdf") {
    return {
      ok: false,
      code: "MIME_EXT_MISMATCH",
      error: "File content is PDF but the extension is not .pdf.",
      extension,
    };
  }
  if (signature === "image/jpeg" && ![".jpg", ".jpeg"].includes(extension)) {
    return {
      ok: false,
      code: "MIME_EXT_MISMATCH",
      error: "File content is JPEG but the extension is not .jpg/.jpeg.",
      extension,
    };
  }
  if (signature === "image/png" && extension !== ".png") {
    return {
      ok: false,
      code: "MIME_EXT_MISMATCH",
      error: "File content is PNG but the extension is not .png.",
      extension,
    };
  }
  if (signature === "image/webp" && extension !== ".webp") {
    return {
      ok: false,
      code: "MIME_EXT_MISMATCH",
      error: "File content is WebP but the extension is not .webp.",
      extension,
    };
  }
  if (signature === "application/msword" && extension !== ".doc") {
    return {
      ok: false,
      code: "MIME_EXT_MISMATCH",
      error: "File content is a legacy Word document but the extension is not .doc.",
      extension,
    };
  }
  if (signature === "application/zip") {
    if (extension !== ".docx") {
      return {
        ok: false,
        code: "BAD_SIGNATURE",
        error: "ZIP archives are only accepted as .docx Word documents.",
        extension,
      };
    }
    return {
      ok: true,
      extension,
      detectedMime:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  return {
    ok: true,
    extension,
    detectedMime:
      signature === "application/zip"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : signature,
  };
}

export function isAllowedMime(mime: string): boolean {
  const m = mime.toLowerCase().trim();
  return (
    ALLOWED_MIME_TYPES.includes(m as (typeof ALLOWED_MIME_TYPES)[number]) ||
    m === "application/zip" // intermediate for docx sniff
  );
}

export function getMaxUploadBytes(): number {
  return MAX_UPLOAD_BYTES;
}

export function acceptAttribute(): string {
  return ALLOWED_EXTENSIONS.join(",");
}
