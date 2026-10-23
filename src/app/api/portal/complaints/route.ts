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
  category: z.string().min(2).max(50),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!session.roles.includes("PENSIONER")) return jsonForbidden();

  const pensioner = await prisma.pensioner.findFirst({
    where: { userId: session.id },
  });
  if (!pensioner) return jsonOk({ items: [] });

  const items = await prisma.complaint.findMany({
    where: { pensionerId: pensioner.id },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ items });
}

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

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const reference = generateReference("CMP");
    const complaint = await prisma.complaint.create({
      data: {
        reference,
        pensionerId: pensioner.id,
        submitterName: `${session.firstName} ${session.lastName}`,
        submitterEmail: session.email,
        category: parsed.data.category,
        subject: parsed.data.subject,
        description: parsed.data.description,
        priority: parsed.data.priority || "MEDIUM",
        status: "OPEN",
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PORTAL.COMPLAINT_CREATE",
      entityType: "Complaint",
      entityId: complaint.id,
      afterValues: { reference, category: parsed.data.category },
      outcome: "SUCCESS",
    });

    return jsonOk(complaint, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to submit complaint", 500);
  }
}
