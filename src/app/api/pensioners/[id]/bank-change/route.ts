import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { writeRecordActivity } from "@/lib/audit/record-activity";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE)) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const pensioner = await prisma.pensioner.findUnique({ where: { id } });
  if (!pensioner) return jsonError("Not found", 404);

  const change = await prisma.bankDetailChange.create({
    data: {
      pensionerId: id,
      previousBankName: pensioner.bankName,
      previousAccountNumber: pensioner.bankAccountNumber,
      previousAccountName: pensioner.bankAccountName,
      newBankName: body.bankName || null,
      newAccountNumber: body.bankAccountNumber || null,
      newAccountName: body.bankAccountName || null,
      reason: body.reason || null,
      status: "PENDING",
      requestedById: session.id,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "BANK_DETAIL.REQUEST",
    entityType: "BankDetailChange",
    entityId: change.id,
    afterValues: { pensionerId: id },
  });

  return jsonOk({ change, message: "Bank change requested — pending approval" }, 201);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const changeId = String(body.changeId || "");
  const decision = String(body.decision || "").toUpperCase(); // APPROVE | REJECT
  const change = await prisma.bankDetailChange.findFirst({
    where: { id: changeId, pensionerId: id },
  });
  if (!change) return jsonError("Change request not found", 404);
  if (change.status !== "PENDING") {
    return jsonError("Already decided", 400);
  }

  if (decision === "APPROVE") {
    await prisma.$transaction([
      prisma.bankDetailChange.update({
        where: { id: changeId },
        data: {
          status: "APPROVED",
          approvedById: session.id,
          approvedAt: new Date(),
        },
      }),
      prisma.pensioner.update({
        where: { id },
        data: {
          bankName: change.newBankName,
          bankAccountNumber: change.newAccountNumber,
          bankAccountName: change.newAccountName,
        },
      }),
    ]);
    await writeRecordActivity({
      entityType: "Pensioner",
      entityId: id,
      eventType: "BANK_DETAIL_APPROVED",
      actorId: session.id,
      actorEmail: session.email,
      beforeJson: {
        bank: change.previousBankName,
        account: change.previousAccountNumber,
      },
      afterJson: {
        bank: change.newBankName,
        account: change.newAccountNumber,
      },
    });
  } else {
    await prisma.bankDetailChange.update({
      where: { id: changeId },
      data: {
        status: "REJECTED",
        approvedById: session.id,
        approvedAt: new Date(),
      },
    });
  }

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: `BANK_DETAIL.${decision}`,
    entityType: "BankDetailChange",
    entityId: changeId,
  });

  return jsonOk({ ok: true });
}
