export interface StoredObject {
  /** Opaque key stored in the database (not a public URL) */
  storageKey: string;
  /** Original safe file name for display */
  fileName: string;
  size: number;
  mimeType: string;
}

export interface StorageDriver {
  readonly name: "local" | "s3";
  save(
    folder: string,
    originalName: string,
    data: Buffer,
    mimeType: string
  ): Promise<StoredObject>;
  get(storageKey: string): Promise<{ data: Buffer; mimeType?: string } | null>;
  getSignedDownloadUrl?(
    storageKey: string,
    expiresInSeconds?: number
  ): Promise<string | null>;
  delete?(storageKey: string): Promise<void>;
}

export {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  ALLOWED_EXTENSIONS,
  isAllowedMime,
  getMaxUploadBytes,
  validateUploadMeta,
  validateUploadBuffer,
  acceptAttribute,
} from "./validate-upload";

/** @deprecated prefer validate-upload helpers */
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function sanitizeFileName(originalName: string): string {
  return originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
