import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { getStorage } from "@/lib/storage";
import {
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
} from "@/lib/api/response";

/**
 * Authenticated download of a retirement document.
 * Staff with retirement read/create/review, or the linked pensioner, may download.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { id } = await params;
  const doc = await prisma.retirementDocument.findUnique({
    where: { id },
    include: {
      retirementCase: {
        select: {
          id: true,
          employeeId: true,
          pensioner: { select: { userId: true } },
        },
      },
    },
  });
  if (!doc) return jsonNotFound("Document not found");

  const isStaff =
    hasPermission(session, PERMISSIONS.RETIREMENTS_READ) ||
    hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) ||
    hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW) ||
    session.roles.includes("SUPER_ADMIN");

  const isOwnerPensioner =
    doc.retirementCase.pensioner?.userId === session.id;

  if (!isStaff && !isOwnerPensioner) {
    return jsonForbidden();
  }

  const storage = getStorage();

  // Prefer short-lived signed URL redirect when S3/MinIO is configured
  if (storage.getSignedDownloadUrl && storage.name === "s3") {
    try {
      const url = await storage.getSignedDownloadUrl(doc.filePath, 300);
      if (url) {
        return Response.redirect(url, 302);
      }
    } catch (e) {
      console.warn("Presign failed, streaming instead:", e);
    }
  }

  const object = await storage.get(doc.filePath);
  if (!object) {
    return jsonError("File not found in storage", 404);
  }

  const mime =
    object.mimeType ||
    guessMime(doc.fileName) ||
    "application/octet-stream";

  return new Response(new Uint8Array(object.data), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(object.data.length),
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Storage-Driver": storage.name,
    },
  });
}

function guessMime(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}
