import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const status = String(body.status || "").toUpperCase();
  const allowed = ["UNDER_REVIEW", "APPROVED", "REJECTED", "PAID"];
  if (!allowed.includes(status)) {
    return jsonError(`status must be one of ${allowed.join(", ")}`, 400);
  }

  const claim = await prisma.nextOfKinClaim.findUnique({ where: { id } });
  if (!claim) return jsonError("Claim not found", 404);

  const updated = await prisma.nextOfKinClaim.update({
    where: { id },
    data: {
      status,
      decisionNotes: body.decisionNotes || claim.decisionNotes,
      decidedById: session.id,
      decidedAt: new Date(),
      paidAt: status === "PAID" ? new Date() : claim.paidAt,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "NOK_CLAIM.STATUS",
    entityType: "NextOfKinClaim",
    entityId: id,
    afterValues: { status },
  });

  return jsonOk({ claim: updated });
}
