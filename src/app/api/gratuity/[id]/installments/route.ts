import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { Decimal } from "@prisma/client/runtime/library";
import {
  canProposeGratuityPayment,
  outstandingGratuity,
} from "@/lib/payments/business-rules";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.GRATUITY_MANAGE) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Positive amount required", 400);
  }

  const ent = await prisma.gratuityEntitlement.findUnique({
    where: { id },
    include: { installments: true },
  });
  if (!ent) return jsonError("Entitlement not found", 404);

  const outstanding = outstandingGratuity(
    Number(ent.approvedAmount),
    ent.installments
  );
  const check = canProposeGratuityPayment(outstanding, amount);
  if (!check.ok) return jsonError(check.reason || "Exceeds balance", 400);

  const installmentNo = ent.installments.length + 1;
  const row = await prisma.gratuityInstallment.create({
    data: {
      entitlementId: id,
      installmentNo,
      proposedAmount: new Decimal(amount),
      status: "PROPOSED",
      notes: body.notes || null,
      createdById: session.id,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "GRATUITY.INSTALLMENT_PROPOSE",
    entityType: "GratuityInstallment",
    entityId: row.id,
    afterValues: { amount, outstandingBefore: outstanding },
  });

  return jsonOk({ installment: row, outstandingBefore: outstanding }, 201);
}
