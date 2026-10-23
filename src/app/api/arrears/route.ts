import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { arrearCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateReference } from "@/lib/utils";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.PAYMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE) &&
    !hasPermission(session, PERMISSIONS.PENSIONERS_READ)
  ) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.arrear.findMany({
      where,
      include: {
        pensioner: {
          select: {
            pensionerNumber: true,
            employee: {
              select: { firstName: true, lastName: true, staffNumber: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.arrear.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = arrearCreateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;
    const pensioner = await prisma.pensioner.findUnique({
      where: { id: data.pensionerId },
    });
    if (!pensioner) return jsonError("Pensioner not found", 400);

    const totalAmount = data.monthlyAmount * data.monthsCount;
    const reference = generateReference("ARR");

    const arrear = await prisma.arrear.create({
      data: {
        reference,
        pensionerId: data.pensionerId,
        periodFrom: data.periodFrom,
        periodTo: data.periodTo,
        monthsCount: data.monthsCount,
        monthlyAmount: data.monthlyAmount,
        totalAmount,
        reason: data.reason || null,
        notes: data.notes || null,
        status: "OPEN",
        createdById: session.id,
      },
      include: {
        pensioner: {
          select: { pensionerNumber: true },
        },
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "ARREAR.CREATE",
      entityType: "Arrear",
      entityId: arrear.id,
      afterValues: {
        reference,
        pensionerId: data.pensionerId,
        totalAmount,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(arrear, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to create arrear", 500);
  }
}
