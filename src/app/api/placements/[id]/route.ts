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
    !hasPermission(session, PERMISSIONS.PLACEMENTS_MANAGE) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const record = await prisma.placementRecord.findUnique({ where: { id } });
  if (!record) return jsonError("Not found", 404);

  const status = String(body.status || record.status);
  const data: Record<string, unknown> = {
    status,
    decisionNotes: body.decisionNotes ?? record.decisionNotes,
    outstandingRequirements:
      body.outstandingRequirements ?? record.outstandingRequirements,
    decidedById: session.id,
    decidedAt: new Date(),
  };
  if (status === "ACTIVATED") data.activationDate = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.placementRecord.update({ where: { id }, data });
    if (status === "ACTIVATED") {
      await tx.pensioner.update({
        where: { id: record.pensionerId },
        data: {
          placementStatus: "ACTIVE",
          paymentStatus: "ACTIVE",
          enrolmentDate: new Date(),
        },
      });
    } else if (status === "REJECTED") {
      await tx.pensioner.update({
        where: { id: record.pensionerId },
        data: {
          placementStatus: "INACTIVE",
          statusReason: body.decisionNotes || "Placement rejected",
        },
      });
    }
    return r;
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PLACEMENT.UPDATE",
    entityType: "PlacementRecord",
    entityId: id,
    afterValues: { status },
  });
  return jsonOk({ record: updated });
}
