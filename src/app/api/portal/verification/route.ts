import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateReference } from "@/lib/utils";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

const schema = z.object({
  verificationType: z.enum([
    "IN_PERSON",
    "DOCUMENT_REVIEW",
    "DIGITAL",
    "FIELD",
    "ANNUAL",
    "OTHER",
  ]),
  scheduledDate: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!session.roles.includes("PENSIONER")) return jsonForbidden();

  const pensioner = await prisma.pensioner.findFirst({
    where: { userId: session.id },
  });
  if (!pensioner) {
    return jsonError("No pensioner profile linked", 404);
  }

  const open = await prisma.verificationCase.findFirst({
    where: {
      pensionerId: pensioner.id,
      status: { in: ["PENDING", "IN_PROGRESS", "MORE_INFO"] },
    },
  });
  if (open) {
    return jsonError(
      "You already have an open verification case. Wait for it to be completed.",
      409
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const reference = generateReference("VER");
    const vc = await prisma.verificationCase.create({
      data: {
        reference,
        pensionerId: pensioner.id,
        verificationType: parsed.data.verificationType,
        scheduledDate: parsed.data.scheduledDate
          ? new Date(parsed.data.scheduledDate)
          : null,
        status: "PENDING",
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PORTAL.VERIFICATION_BOOK",
      entityType: "VerificationCase",
      entityId: vc.id,
      afterValues: { reference, pensionerId: pensioner.id },
      outcome: "SUCCESS",
    });

    return jsonOk(vc, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to book verification", 500);
  }
}
