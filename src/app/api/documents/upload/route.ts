import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  getStorage,
  validateUploadBuffer,
} from "@/lib/storage";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
} from "@/lib/api/response";

/**
 * Multipart upload for retirement case documents.
 * Stores file privately and creates RetirementDocument metadata.
 *
 * Form fields: file, retirementCaseId, documentType, remarks?
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW)
  ) {
    return jsonForbidden();
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const retirementCaseId = String(form.get("retirementCaseId") || "");
    const documentType = String(form.get("documentType") || "OTHER");
    const remarks = form.get("remarks") ? String(form.get("remarks")) : null;

    if (!retirementCaseId) {
      return jsonError("retirementCaseId is required", 400);
    }
    if (!(file instanceof File)) {
      return jsonError("file is required", 400);
    }

    const rc = await prisma.retirementCase.findUnique({
      where: { id: retirementCaseId },
    });
    if (!rc) return jsonError("Retirement case not found", 404);
    if (rc.status === "CLOSED" || rc.status === "REJECTED") {
      return jsonError("Cannot attach documents to a closed case", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadBuffer({
      fileName: file.name,
      size: file.size || buffer.length,
      mimeType: file.type || null,
      data: buffer,
    });
    if (!validation.ok) {
      return jsonError(validation.error || "Invalid file", 400);
    }

    const mime =
      validation.detectedMime ||
      file.type ||
      "application/octet-stream";

    const saved = await getStorage().save(
      `retirement/${retirementCaseId}`,
      file.name,
      buffer,
      mime
    );

    const doc = await prisma.retirementDocument.create({
      data: {
        retirementCaseId,
        documentType,
        fileName: saved.fileName,
        filePath: saved.storageKey,
        status: "SUBMITTED",
        remarks: remarks
          ? `${remarks} [mime=${mime}; size=${saved.size}]`
          : `mime=${mime}; size=${saved.size}`,
      },
    });

    await prisma.retirementTimeline.create({
      data: {
        retirementCaseId,
        stage: rc.currentStage,
        action: "DOCUMENT_UPLOADED",
        performedById: session.id,
        comments: `${documentType}: ${saved.fileName}`,
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "DOCUMENT.UPLOAD",
      entityType: "RetirementDocument",
      entityId: doc.id,
      afterValues: {
        retirementCaseId,
        documentType,
        fileName: saved.fileName,
        storageKey: saved.storageKey,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(
      {
        id: doc.id,
        fileName: doc.fileName,
        documentType: doc.documentType,
        status: doc.status,
        storageKey: saved.storageKey,
      },
      201
    );
  } catch (e) {
    console.error("Upload error:", e);
    return jsonError(
      e instanceof Error ? e.message : "Upload failed",
      500
    );
  }
}
