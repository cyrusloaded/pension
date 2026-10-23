import { createLocalDriver } from "./local-driver";
import { createS3Driver } from "./s3-driver";
import type { StorageDriver, StoredObject } from "./types";
import {
  isAllowedMime,
  getMaxUploadBytes,
  MAX_UPLOAD_LABEL,
  ALLOWED_EXTENSIONS,
  validateUploadMeta,
  validateUploadBuffer,
  acceptAttribute,
} from "./validate-upload";

export type { StorageDriver, StoredObject };
export {
  isAllowedMime,
  getMaxUploadBytes,
  MAX_UPLOAD_LABEL,
  ALLOWED_EXTENSIONS,
  validateUploadMeta,
  validateUploadBuffer,
  acceptAttribute,
};

let cached: StorageDriver | null = null;

/**
 * Resolve storage driver from environment.
 * STORAGE_DRIVER=local (default) | s3
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;

  const driver = (
    process.env.STORAGE_DRIVER ||
    (process.env.S3_ENDPOINT || process.env.OBJECT_STORAGE_ENDPOINT
      ? "s3"
      : "local")
  ).toLowerCase();

  if (driver === "s3") {
    const endpoint =
      process.env.S3_ENDPOINT ||
      process.env.OBJECT_STORAGE_ENDPOINT ||
      undefined;
    const accessKeyId =
      process.env.S3_ACCESS_KEY_ID ||
      process.env.OBJECT_STORAGE_ACCESS_KEY ||
      "";
    const secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY ||
      process.env.OBJECT_STORAGE_SECRET_KEY ||
      "";
    const bucket =
      process.env.S3_BUCKET ||
      process.env.OBJECT_STORAGE_BUCKET ||
      "kscspms-documents";
    const region = process.env.S3_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      console.warn(
        "[storage] S3 selected but credentials missing — falling back to local"
      );
      cached = createLocalDriver();
    } else {
      cached = createS3Driver({
        endpoint: endpoint || undefined,
        region,
        accessKeyId,
        secretAccessKey,
        bucket,
        forcePathStyle: Boolean(endpoint),
      });
    }
  } else {
    cached = createLocalDriver();
  }

  return cached;
}

/** @deprecated use getStorage().save */
export async function savePrivateFile(
  folder: string,
  originalName: string,
  data: Buffer,
  mimeType: string
): Promise<{ storageKey: string; fileName: string; size: number }> {
  const stored = await getStorage().save(folder, originalName, data, mimeType);
  return {
    storageKey: stored.storageKey,
    fileName: stored.fileName,
    size: stored.size,
  };
}
