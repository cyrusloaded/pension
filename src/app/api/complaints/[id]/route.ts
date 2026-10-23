import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { writeAuditLog } from "@/lib/audit/logger";
import { createNotification } from "@/lib/notifications/create";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
} from "@/lib/api/response";

const updateSchema = z.object({
  status: z.enum([
    "OPEN",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "REOPENED",
  ]),
  resolution: z.string().max(5000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.COMPLAINTS_MANAGE) &&
    !session.roles.includes("SUPER_ADMIN")
  ) {
    return jsonForbidden();
  }

  const { id } = await params;
  const existing = await prisma.complaint.findUnique({
    where: { id },
    include: {
      pensioner: { select: { userId: true, pensionerNumber: true } },
    },
  });
  if (!existing) return jsonNotFound();

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data: Record<string, unknown> = {
      status: parsed.data.status,
    };
    if (parsed.data.resolution !== undefined) {
      data.resolution = parsed.data.resolution;
    }
    if (parsed.data.priority) {
      data.priority = parsed.data.priority;
    }
    if (parsed.data.status === "ASSIGNED" || parsed.data.status === "IN_PROGRESS") {
      data.assignedOfficerId = session.id;
    }
    if (parsed.data.status === "CLOSED" || parsed.data.status === "RESOLVED") {
      data.closedAt = new Date();
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data,
    });

    if (
      existing.pensioner?.userId &&
      ["RESOLVED", "CLOSED", "IN_PROGRESS"].includes(parsed.data.status)
    ) {
      await createNotification({
        userId: existing.pensioner.userId,
        title: `Complaint ${existing.reference} updated`,
        message: `Status is now ${parsed.data.status}.${
          parsed.data.resolution ? ` ${parsed.data.resolution.slice(0, 200)}` : ""
        }`,
        type: "INFO",
        link: "/portal/complaints",
      });
    }

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "COMPLAINT.UPDATE",
      entityType: "Complaint",
      entityId: id,
      beforeValues: { status: existing.status },
      afterValues: { status: parsed.data.status },
      outcome: "SUCCESS",
    });

    return jsonOk(updated);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to update complaint", 500);
  }
}
