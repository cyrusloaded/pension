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
import { getGratuityLedger } from "@/lib/gratuity/ledger";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.GRATUITY_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const pensionerId = req.nextUrl.searchParams.get("pensionerId");
  if (pensionerId) {
    const ledger = await getGratuityLedger(pensionerId);
    return jsonOk({ ledger });
  }
  const list = await prisma.gratuityEntitlement.findMany({
    include: {
      installments: true,
      pensioner: { select: { pensionerNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const rows = list.map((e) => {
    const outstanding = outstandingGratuity(
      Number(e.approvedAmount),
      e.installments
    );
    return {
      id: e.id,
      pensionerNumber: e.pensioner.pensionerNumber,
      approvedAmount: Number(e.approvedAmount),
      outstanding,
      totalPaid: Number(e.approvedAmount) - outstanding,
      status: e.status,
      installmentCount: e.installments.length,
    };
  });
  return jsonOk({ entitlements: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.GRATUITY_MANAGE) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)
  ) {
    return jsonError("Forbidden", 403);
  }
  const body = await req.json();
  const pensionerId = String(body.pensionerId || "");
  const approvedAmount = Number(body.approvedAmount);
  if (!pensionerId || !Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    return jsonError("pensionerId and positive approvedAmount required", 400);
  }

  const existing = await prisma.gratuityEntitlement.findUnique({
    where: { pensionerId },
  });
  if (existing) {
    return jsonError("Gratuity entitlement already exists for this pensioner", 409);
  }

  const ent = await prisma.gratuityEntitlement.create({
    data: {
      pensionerId,
      approvedAmount: new Decimal(approvedAmount),
      approvedAt: new Date(),
      approvedById: session.id,
      benefitAssessmentId: body.benefitAssessmentId || null,
      notes: body.notes || null,
      status: "ACTIVE",
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "GRATUITY.ENTITLEMENT_CREATE",
    entityType: "GratuityEntitlement",
    entityId: ent.id,
    afterValues: { pensionerId, approvedAmount },
  });

  return jsonOk({ entitlement: ent }, 201);
}
