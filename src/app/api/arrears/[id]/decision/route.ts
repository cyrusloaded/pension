import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { arrearDecisionSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
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

  const { id } = await params;
  const existing = await prisma.arrear.findUnique({ where: { id } });
  if (!existing) return jsonNotFound();

  try {
    const body = await req.json();
    const parsed = arrearDecisionSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { action, notes } = parsed.data;
    let status = existing.status;
    const data: Record<string, unknown> = {
      notes: notes || existing.notes,
    };

    switch (action) {
      case "APPROVE":
        if (!hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)) {
          return jsonForbidden();
        }
        if (existing.status !== "OPEN") {
          return jsonError("Only OPEN arrears can be approved", 400);
        }
        status = "APPROVED";
        data.approvedById = session.id;
        data.approvedAt = new Date();
        break;
      case "CANCEL":
        if (
          !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
          !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
        ) {
          return jsonForbidden();
        }
        if (["PAID", "WRITTEN_OFF"].includes(existing.status)) {
          return jsonError("Cannot cancel paid or written-off arrears", 400);
        }
        status = "CANCELLED";
        break;
      case "WRITE_OFF":
        if (!hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)) {
          return jsonForbidden();
        }
        status = "WRITTEN_OFF";
        break;
      case "MARK_PAID":
        if (
          !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) &&
          !hasPermission(session, PERMISSIONS.PAYMENTS_RECONCILE)
        ) {
          return jsonForbidden();
        }
        if (!["APPROVED", "SCHEDULED", "OPEN"].includes(existing.status)) {
          return jsonError("Invalid status for marking paid", 400);
        }
        status = "PAID";
        data.paidAt = new Date();
        break;
      default:
        return jsonError("Unknown action", 400);
    }

    data.status = status;

    const updated = await prisma.arrear.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: `ARREAR.${action}`,
      entityType: "Arrear",
      entityId: id,
      beforeValues: { status: existing.status },
      afterValues: { status },
      reason: notes || undefined,
      outcome: "SUCCESS",
    });

    return jsonOk(updated);
  } catch (e) {
    console.error(e);
    return jsonError("Decision failed", 500);
  }
}
