import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

const schema = z.object({
  bankName: z.string().min(2).max(100),
  bankAccountNumber: z.string().min(6).max(20),
  bankAccountName: z.string().min(2).max(150),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!session.roles.includes("PENSIONER")) return jsonForbidden();

  const pensioner = await prisma.pensioner.findFirst({
    where: { userId: session.id },
  });
  if (!pensioner) {
    return jsonError("No pensioner profile linked to this account", 404);
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const before = {
      bankName: pensioner.bankName,
      bankAccountNumber: pensioner.bankAccountNumber
        ? `****${pensioner.bankAccountNumber.slice(-4)}`
        : null,
      bankAccountName: pensioner.bankAccountName,
    };

    const updated = await prisma.pensioner.update({
      where: { id: pensioner.id },
      data: {
        bankName: parsed.data.bankName,
        bankAccountNumber: parsed.data.bankAccountNumber,
        bankAccountName: parsed.data.bankAccountName,
        // Flag for re-verification of banking details
        verificationStatus:
          pensioner.verificationStatus === "VERIFIED"
            ? "PENDING"
            : pensioner.verificationStatus,
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PORTAL.BANK_UPDATE",
      entityType: "Pensioner",
      entityId: pensioner.id,
      beforeValues: before,
      afterValues: {
        bankName: parsed.data.bankName,
        bankAccountNumber: `****${parsed.data.bankAccountNumber.slice(-4)}`,
        bankAccountName: parsed.data.bankAccountName,
      },
      outcome: "SUCCESS",
    });

    return jsonOk({
      id: updated.id,
      bankName: updated.bankName,
      bankAccountName: updated.bankAccountName,
    });
  } catch (e) {
    console.error(e);
    return jsonError("Failed to update profile", 500);
  }
}
