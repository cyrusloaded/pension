import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { verificationDecisionSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { createNotification } from "@/lib/notifications/create";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
} from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)) {
    return jsonForbidden();
  }

  const { id } = await params;
  const existing = await prisma.verificationCase.findUnique({
    where: { id },
    include: {
      pensioner: { select: { id: true, userId: true, pensionerNumber: true } },
      employee: {
        select: { id: true, staffNumber: true, firstName: true, lastName: true },
      },
    },
  });
  if (!existing) return jsonNotFound("Verification case not found");

  if (["APPROVED", "REJECTED"].includes(existing.status)) {
    return jsonError("Case already has a final decision", 400);
  }

  try {
    const body = await req.json();
    const parsed = verificationDecisionSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { decision, decisionReason } = parsed.data;

    const statusMap = {
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      MORE_INFO: "MORE_INFO",
    } as const;

    const updated = await prisma.$transaction(async (tx) => {
      const vc = await tx.verificationCase.update({
        where: { id },
        data: {
          status: statusMap[decision],
          decision,
          decisionReason: decisionReason || null,
          decidedById: session.id,
          decidedAt: new Date(),
          completedDate: decision === "MORE_INFO" ? null : new Date(),
        },
      });

      // Update pensioner verification status when linked
      if (existing.pensionerId && decision !== "MORE_INFO") {
        await tx.pensioner.update({
          where: { id: existing.pensionerId },
          data: {
            verificationStatus:
              decision === "APPROVED" ? "VERIFIED" : "FAILED",
          },
        });
      }

      return vc;
    });

    // Notify pensioner's user account if linked
    if (existing.pensioner?.userId) {
      await createNotification({
        userId: existing.pensioner.userId,
        title: `Verification ${decision === "APPROVED" ? "approved" : decision === "REJECTED" ? "rejected" : "needs more information"}`,
        message:
          decisionReason ||
          `Your verification case ${existing.reference} has been ${decision.toLowerCase()}.`,
        type: decision === "APPROVED" ? "SUCCESS" : "WARNING",
        link: "/portal/verification",
      });
    }

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "VERIFICATION.DECISION",
      entityType: "VerificationCase",
      entityId: id,
      beforeValues: { status: existing.status },
      afterValues: { status: statusMap[decision], decision },
      reason: decisionReason || undefined,
      outcome: "SUCCESS",
    });

    return jsonOk(updated);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to record decision", 500);
  }
}
