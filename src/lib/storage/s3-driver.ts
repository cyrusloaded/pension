import { randomBytes } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageDriver, StoredObject } from "./types";
import { sanitizeFileName } from "./types";
import { isAllowedMime, MAX_UPLOAD_BYTES } from "./validate-upload";

export interface S3Config {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

function streamToBuffer(
  stream: NodeJS.ReadableStream | ReadableStream | Blob | undefined
): Promise<Buffer> {
  if (!stream) return Promise.resolve(Buffer.alloc(0));
  // AWS SDK v3 in Node returns a Readable
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const readable = stream as NodeJS.ReadableStream;
    if (typeof (readable as { on?: unknown }).on === "function") {
      readable.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      readable.on("end", () => resolve(Buffer.concat(chunks)));
      readable.on("error", reject);
      return;
    }
    // Web ReadableStream fallback
    const web = stream as ReadableStream<Uint8Array>;
    const reader = web.getReader();
    (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(Buffer.from(value));
        }
        resolve(Buffer.concat(chunks));
      } catch (e) {
        reject(e);
      }
    })();
  });
}

export function createS3Driver(config: S3Config): StorageDriver {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const bucket = config.bucket;
  let bucketReady: Promise<void> | null = null;

  async function ensureBucket() {
    if (!bucketReady) {
      bucketReady = (async () => {
        try {
          await client.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch {
          try {
            await client.send(new CreateBucketCommand({ Bucket: bucket }));
          } catch (e) {
            // Race or policy — surface on first write if still broken
            console.warn("S3 bucket ensure:", e);
          }
        }
      })();
    }
    await bucketReady;
  }

  return {
    name: "s3",

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

      await ensureBucket();

      const safeBase = sanitizeFileName(originalName);
      const id = randomBytes(8).toString("hex");
      const storageKey = `${folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${id}-${safeBase}`;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: data,
          ContentType: mimeType,
          // Private by default — no public ACL
          ServerSideEncryption: config.endpoint ? undefined : "AES256",
        })
      );

      return {
        storageKey,
        fileName: safeBase,
        size: data.length,
        mimeType,
      };
    },

    async get(storageKey: string) {
      try {
        const out = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: storageKey,
          })
        );
        const data = await streamToBuffer(
          out.Body as NodeJS.ReadableStream | undefined
        );
        return {
          data,
          mimeType: out.ContentType || undefined,
        };
      } catch {
        return null;
      }
    },

    async getSignedDownloadUrl(storageKey: string, expiresInSeconds = 300) {
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      });
      return getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
    },

    async delete(storageKey: string) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: storageKey,
          })
        );
      } catch {
        // ignore
      }
    },
  };
}
