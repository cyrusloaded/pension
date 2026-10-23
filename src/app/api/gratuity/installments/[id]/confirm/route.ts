import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { Decimal } from "@prisma/client/runtime/library";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.SCHEDULE_DFA_PAY) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const inst = await prisma.gratuityInstallment.findUnique({ where: { id } });
  if (!inst) return jsonError("Installment not found", 404);
  if (inst.status === "PAID") return jsonError("Already paid", 400);

  const paidAmount = Number(body.paidAmount ?? inst.proposedAmount);
  const updated = await prisma.gratuityInstallment.update({
    where: { id },
    data: {
      status: "PAID",
      paidAmount: new Decimal(paidAmount),
      paidAt: new Date(),
      transactionRef: body.transactionRef || `GRAT-${Date.now()}`,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "GRATUITY.INSTALLMENT_PAID",
    entityType: "GratuityInstallment",
    entityId: id,
    afterValues: { paidAmount, transactionRef: updated.transactionRef },
  });

  return jsonOk({ installment: updated });
}
