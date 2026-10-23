import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { pensionRuleApproveSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
} from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const { id } = await params;
  const rv = await prisma.pensionRuleVersion.findUnique({
    where: { id },
    include: { scheme: true },
  });
  if (!rv) return jsonNotFound();
  return jsonOk(rv);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.SETTINGS_MANAGE)) {
    return jsonForbidden();
  }

  const { id } = await params;
  const existing = await prisma.pensionRuleVersion.findUnique({
    where: { id },
  });
  if (!existing) return jsonNotFound();

  try {
    const body = await req.json();
    const parsed = pensionRuleApproveSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const { action } = parsed.data;
    let status = existing.status;
    const data: Record<string, unknown> = {};

    switch (action) {
      case "SUBMIT":
        if (existing.status !== "DRAFT") {
          return jsonError("Only DRAFT rules can be submitted", 400);
        }
        status = "PENDING_APPROVAL";
        break;
      case "APPROVE":
        if (!["DRAFT", "PENDING_APPROVAL"].includes(existing.status)) {
          return jsonError("Invalid status for approval", 400);
        }
        status = "APPROVED";
        data.approvedAt = new Date();
        data.approvedById = session.id;
        // Supersede previous approved versions for same scheme
        await prisma.pensionRuleVersion.updateMany({
          where: {
            schemeId: existing.schemeId,
            status: "APPROVED",
            NOT: { id },
          },
          data: { status: "SUPERSEDED" },
        });
        break;
      case "REJECT":
        if (existing.status !== "PENDING_APPROVAL") {
          return jsonError("Only pending rules can be rejected", 400);
        }
        status = "DRAFT";
        break;
      case "SUPERSEDE":
        if (existing.status !== "APPROVED") {
          return jsonError("Only approved rules can be superseded", 400);
        }
        status = "SUPERSEDED";
        break;
      default:
        return jsonError("Unknown action", 400);
    }

    data.status = status;

    const updated = await prisma.pensionRuleVersion.update({
      where: { id },
      data,
      include: { scheme: { select: { name: true, code: true } } },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: `PENSION_RULE.${action}`,
      entityType: "PensionRuleVersion",
      entityId: id,
      beforeValues: { status: existing.status },
      afterValues: { status },
      reason: parsed.data.comments || undefined,
      outcome: "SUCCESS",
    });

    return jsonOk(updated);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to update rule version", 500);
  }
}
