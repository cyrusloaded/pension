import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { writeRecordActivity } from "@/lib/audit/record-activity";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Report or verify death on EXISTING pensioner profile (no new person created).
 * Blocks ordinary monthly pay (BR-08). Does not approve NOK benefits.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE) &&
    !hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)
  ) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const action = String(body.action || "REPORT").toUpperCase(); // REPORT | VERIFY | DISPUTE | REJECT

  const pensioner = await prisma.pensioner.findUnique({ where: { id } });
  if (!pensioner) return jsonError("Pensioner not found", 404);

  const data: Record<string, unknown> = {};

  if (action === "REPORT") {
    data.dateOfDeath = body.dateOfDeath
      ? new Date(body.dateOfDeath)
      : pensioner.dateOfDeath || new Date();
    data.deathReportedAt = new Date();
    data.deathReportedById = session.id;
    data.deathReportSource = body.source || "OFFICER_REPORT";
    data.deathVerificationStatus = "REPORTED";
    data.paymentStatus = "DECEASED";
    data.placementStatus = "DECEASED";
    data.isActive = false;
    data.statusReason = body.reason || "Death reported — pending verification";
  } else if (action === "VERIFY") {
    if (
      !hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE) &&
      !hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE)
    ) {
      return jsonError("Verification permission required", 403);
    }
    data.deathVerificationStatus = "VERIFIED";
    data.deathVerifiedById = session.id;
    data.deathVerifiedAt = new Date();
    data.paymentStatus = "DECEASED";
    data.placementStatus = "DECEASED";
    data.isActive = false;
    data.statusReason = body.reason || "Death verified";
  } else if (action === "DISPUTE") {
    data.deathVerificationStatus = "DISPUTED";
    data.statusReason = body.reason || "Death report disputed";
  } else if (action === "REJECT") {
    data.deathVerificationStatus = "REJECTED";
    data.statusReason = body.reason || "Death report rejected";
    // do not auto-reactivate payroll without explicit process
  } else {
    return jsonError("action must be REPORT, VERIFY, DISPUTE, or REJECT", 400);
  }

  const updated = await prisma.pensioner.update({ where: { id }, data });

  // Optional verification case for evidence trail
  if (action === "REPORT") {
    await prisma.verificationCase.create({
      data: {
        reference: `DEATH-${Date.now().toString(36).toUpperCase()}`,
        pensionerId: id,
        verificationType: "DEATH",
        status: "PENDING",
        decisionReason: body.reason || "Death reported",
      },
    }).catch(() => null);
  }

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: `PENSIONER.DEATH_${action}`,
    entityType: "Pensioner",
    entityId: id,
    afterValues: { action, deathVerificationStatus: data.deathVerificationStatus },
  });
  await writeRecordActivity({
    entityType: "Pensioner",
    entityId: id,
    eventType: `DEATH_${action}`,
    summary: `Death ${action.toLowerCase()} on ${pensioner.pensionerNumber}`,
    actorId: session.id,
    actorEmail: session.email,
    reason: body.reason,
  });

  return jsonOk({
    pensioner: updated,
    message:
      action === "REPORT"
        ? "Death reported. Ordinary monthly pay blocked. NOK claims require separate approval."
        : `Death status updated: ${action}`,
  });
}
