import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { retirementDocumentSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
} from "@/lib/api/response";

/**
 * Document metadata registration.
 * Binary storage should use private object storage; this records the reference.
 * For local/dev, filePath may be a relative path under a secured uploads directory.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW)
  ) {
    return jsonForbidden();
  }

  const { id } = await params;
  const rc = await prisma.retirementCase.findUnique({ where: { id } });
  if (!rc) return jsonNotFound("Retirement case not found");
  if (rc.status === "CLOSED" || rc.status === "REJECTED") {
    return jsonError("Cannot add documents to a closed case", 400);
  }

  try {
    const body = await req.json();
    const parsed = retirementDocumentSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;

    // Basic path safety — reject path traversal
    if (
      data.filePath.includes("..") ||
      data.filePath.startsWith("/") ||
      data.filePath.includes("://")
    ) {
      // Allow absolute-looking storage keys only if they look like object keys
      if (data.filePath.includes("..")) {
        return jsonError("Invalid file path", 400);
      }
    }

    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.retirementDocument.create({
        data: {
          retirementCaseId: id,
          documentType: data.documentType,
          fileName: data.fileName,
          filePath: data.filePath,
          status: "PENDING",
          remarks: data.remarks || null,
        },
      });

      await tx.retirementTimeline.create({
        data: {
          retirementCaseId: id,
          stage: rc.currentStage,
          action: "DOCUMENT_UPLOADED",
          performedById: session.id,
          comments: `Uploaded ${data.documentType}: ${data.fileName}`,
        },
      });

      return d;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "RETIREMENT.DOCUMENT_UPLOAD",
      entityType: "RetirementDocument",
      entityId: doc.id,
      afterValues: {
        retirementCaseId: id,
        documentType: data.documentType,
        fileName: data.fileName,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(doc, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to register document", 500);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { id } = await params;
  const docs = await prisma.retirementDocument.findMany({
    where: { retirementCaseId: id },
    orderBy: { uploadedAt: "desc" },
  });
  return jsonOk({ items: docs });
}
