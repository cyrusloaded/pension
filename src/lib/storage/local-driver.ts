import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import type { StorageDriver, StoredObject } from "./types";
import { sanitizeFileName } from "./types";
import { isAllowedMime, MAX_UPLOAD_BYTES } from "./validate-upload";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export function createLocalDriver(): StorageDriver {
  return {
    name: "local",

    async save(
      folder: string,
      originalName: string,
      data: Buffer,
      mimeType: string
    ): Promise<StoredObject> {
      if (!isAllowedMime(mimeType)) {
        throw new Error("File type not allowed");
      }
      if (data.length > MAX_UPLOAD_BYTES) {
        throw new Error("File exceeds maximum size of 10MB");
      }

      const safeBase = sanitizeFileName(originalName);
      const id = randomBytes(8).toString("hex");
      const storedName = `${Date.now()}-${id}-${safeBase}`;
      const dir = path.join(UPLOAD_ROOT, folder);
      await mkdir(dir, { recursive: true });
      const fullPath = path.join(dir, storedName);
      await writeFile(fullPath, data);

      const storageKey = path.join(folder, storedName).replace(/\\/g, "/");
      return {
        storageKey,
        fileName: safeBase,
        size: data.length,
        mimeType,
      };
    },

    async get(storageKey: string) {
      // Prevent path traversal
      const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
      const fullPath = path.join(UPLOAD_ROOT, normalized);
      if (!fullPath.startsWith(UPLOAD_ROOT)) {
        return null;
      }
      try {
        const data = await readFile(fullPath);
        return { data };
      } catch {
        return null;
      }
    },

    async getSignedDownloadUrl() {
      return null;
    },

    async delete(storageKey: string) {
      const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
      const fullPath = path.join(UPLOAD_ROOT, normalized);
      if (!fullPath.startsWith(UPLOAD_ROOT)) return;
      try {
        await unlink(fullPath);
      } catch {
        // ignore missing
      }
    },
  };
}
