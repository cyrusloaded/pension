import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { Decimal } from "@prisma/client/runtime/library";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ) &&
    !hasPermission(session, PERMISSIONS.COMPLAINTS_READ)
  ) {
    return jsonError("Forbidden", 403);
  }
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(req.nextUrl.searchParams.get("pageSize") || "25", 10)));
  const status = req.nextUrl.searchParams.get("status") || undefined;

  const where = status ? { status } : {};
  const [total, items] = await Promise.all([
    prisma.nextOfKinClaim.count({ where }),
    prisma.nextOfKinClaim.findMany({
      where,
      include: {
        pensioner: {
          select: {
            pensionerNumber: true,
            paymentStatus: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return jsonOk({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_UPDATE) &&
    !hasPermission(session, PERMISSIONS.COMPLAINTS_MANAGE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const body = await req.json();
  const pensionerId = String(body.pensionerId || "");
  if (!pensionerId) return jsonError("pensionerId required", 400);

  const pensioner = await prisma.pensioner.findUnique({ where: { id: pensionerId } });
  if (!pensioner) return jsonError("Pensioner not found — link claim to existing profile only", 404);

  const ref = `NOK-${Date.now().toString(36).toUpperCase()}`;
  const claim = await prisma.nextOfKinClaim.create({
    data: {
      reference: ref,
      pensionerId,
      claimantName: String(body.claimantName || "").trim(),
      claimantPhone: body.claimantPhone || null,
      claimantEmail: body.claimantEmail || null,
      relationship: String(body.relationship || "NEXT_OF_KIN"),
      claimType: body.claimType || "GRATUITY",
      amountClaimed:
        body.amountClaimed != null ? new Decimal(Number(body.amountClaimed)) : null,
      status: "SUBMITTED",
      documentsNote: body.documentsNote || null,
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "NOK_CLAIM.CREATE",
    entityType: "NextOfKinClaim",
    entityId: claim.id,
    afterValues: { reference: ref, pensionerId, status: "SUBMITTED" },
  });

  return jsonOk({
    claim,
    message:
      "Claim submitted. Not entitled to payment until verification and approval (BR-09).",
  }, 201);
}
