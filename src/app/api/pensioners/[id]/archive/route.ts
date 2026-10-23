import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { writeRecordActivity } from "@/lib/audit/record-activity";

type Ctx = { params: Promise<{ id: string }> };

/** Soft-archive: deactivate without deleting financial history. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE)) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason || "Archived by administrator");

  const pensioner = await prisma.pensioner.findUnique({ where: { id } });
  if (!pensioner) return jsonError("Not found", 404);

  const updated = await prisma.pensioner.update({
    where: { id },
    data: {
      isActive: false,
      paymentStatus:
        pensioner.paymentStatus === "DECEASED"
          ? "DECEASED"
          : "STOPPED",
      placementStatus:
        pensioner.placementStatus === "DECEASED"
          ? "DECEASED"
          : "INACTIVE",
      statusReason: reason,
      deactivatedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PENSIONER.ARCHIVE",
    entityType: "Pensioner",
    entityId: id,
    afterValues: { reason },
  });
  await writeRecordActivity({
    entityType: "Pensioner",
    entityId: id,
    eventType: "ARCHIVE",
    summary: reason,
    actorId: session.id,
    actorEmail: session.email,
    reason,
  });

  return jsonOk({
    pensioner: updated,
    message: "Record archived (soft). Payment history retained.",
  });
}
