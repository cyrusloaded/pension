import { describe, it, expect } from "vitest";
import {
  validateUploadMeta,
  validateUploadBuffer,
  detectMimeFromBuffer,
  MAX_UPLOAD_BYTES,
} from "../src/lib/storage/validate-upload";

describe("validateUploadMeta", () => {
  it("rejects empty files", () => {
    const r = validateUploadMeta({ fileName: "a.pdf", size: 0 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("EMPTY");
  });

  it("rejects oversized files", () => {
    const r = validateUploadMeta({
      fileName: "a.pdf",
      size: MAX_UPLOAD_BYTES + 1,
      mimeType: "application/pdf",
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("TOO_LARGE");
  });

  it("rejects disallowed extensions", () => {
    const r = validateUploadMeta({
      fileName: "malware.exe",
      size: 100,
      mimeType: "application/octet-stream",
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("BAD_EXTENSION");
  });

  it("accepts valid pdf meta", () => {
    const r = validateUploadMeta({
      fileName: "letter.pdf",
      size: 1024,
      mimeType: "application/pdf",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects mime/extension mismatch", () => {
    const r = validateUploadMeta({
      fileName: "photo.pdf",
      size: 1024,
      mimeType: "image/png",
    });
    expect(r.ok).toBe(false);
  });
});

describe("magic bytes", () => {
  it("detects PDF signature", () => {
    const buf = Buffer.from("%PDF-1.7\n...");
    expect(detectMimeFromBuffer(buf)).toBe("application/pdf");
  });

  it("detects PNG signature", () => {
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(detectMimeFromBuffer(buf)).toBe("image/png");
  });

  it("rejects content that does not match extension", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const r = validateUploadBuffer({
      fileName: "fake.pdf",
      size: png.length,
      mimeType: "application/pdf",
      data: png,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("MIME_EXT_MISMATCH");
  });

  it("accepts real PDF bytes with .pdf name", () => {
    const pdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n");
    const r = validateUploadBuffer({
      fileName: "doc.pdf",
      size: pdf.length,
      mimeType: "application/pdf",
      data: pdf,
    });
    expect(r.ok).toBe(true);
    expect(r.detectedMime).toBe("application/pdf");
  });
});
