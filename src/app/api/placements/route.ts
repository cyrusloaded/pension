import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PLACEMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ)
  ) {
    return jsonError("Forbidden", 403);
  }
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const records = await prisma.placementRecord.findMany({
    where: status ? { status } : undefined,
    include: {
      pensioner: {
        select: {
          pensionerNumber: true,
          placementStatus: true,
          paymentStatus: true,
          retirementDate: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { placementDate: "desc" },
    take: 200,
  });
  return jsonOk({ records });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PLACEMENTS_MANAGE) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_CREATE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const body = await req.json();
  const pensionerId = String(body.pensionerId || "");
  if (!pensionerId) return jsonError("pensionerId required", 400);

  const pensioner = await prisma.pensioner.findUnique({
    where: { id: pensionerId },
  });
  if (!pensioner) return jsonError("Pensioner not found", 404);

  const record = await prisma.$transaction(async (tx) => {
    const r = await tx.placementRecord.create({
      data: {
        pensionerId,
        category: body.category || "NEW_PLACEMENT",
        status: "PENDING",
        outstandingRequirements: body.outstandingRequirements || null,
        createdById: session.id,
      },
    });
    await tx.pensioner.update({
      where: { id: pensionerId },
      data: {
        placementStatus: "NEW_PLACEMENT",
        paymentStatus: "PENDING",
      },
    });
    return r;
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PLACEMENT.CREATE",
    entityType: "PlacementRecord",
    entityId: record.id,
    afterValues: { pensionerId, status: record.status },
  });

  return jsonOk({ record }, 201);
}
