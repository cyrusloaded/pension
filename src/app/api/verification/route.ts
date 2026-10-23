import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { verificationCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateReference } from "@/lib/utils";
import { createNotification } from "@/lib/notifications/create";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.VERIFICATION_READ) &&
    !hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)
  ) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
  );

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      {
        employee: {
          OR: [
            { staffNumber: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
      },
      {
        pensioner: {
          pensionerNumber: { contains: q, mode: "insensitive" },
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.verificationCase.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            staffNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        pensioner: {
          select: {
            id: true,
            pensionerNumber: true,
            bankAccountName: true,
          },
        },
        evidence: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.verificationCase.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.VERIFICATION_MANAGE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = verificationCreateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;
    if (!data.employeeId && !data.pensionerId) {
      return jsonError("Either employeeId or pensionerId is required", 400);
    }

    if (data.employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: data.employeeId },
      });
      if (!emp) return jsonError("Employee not found", 400);
    }
    if (data.pensionerId) {
      const pen = await prisma.pensioner.findUnique({
        where: { id: data.pensionerId },
      });
      if (!pen) return jsonError("Pensioner not found", 400);
    }

    const reference = generateReference("VER");

    const vc = await prisma.verificationCase.create({
      data: {
        reference,
        employeeId: data.employeeId || null,
        pensionerId: data.pensionerId || null,
        verificationType: data.verificationType,
        status: "PENDING",
        scheduledDate: parseDate(data.scheduledDate),
        assignedOfficerId: data.assignedOfficerId || session.id,
      },
      include: {
        employee: {
          select: { staffNumber: true, firstName: true, lastName: true },
        },
        pensioner: { select: { pensionerNumber: true } },
      },
    });

    if (data.assignedOfficerId && data.assignedOfficerId !== session.id) {
      await createNotification({
        userId: data.assignedOfficerId,
        title: "Verification case assigned",
        message: `Verification ${reference} has been assigned to you.`,
        type: "ASSIGNMENT",
        link: `/admin/verification/${vc.id}`,
      });
    }

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "VERIFICATION.CREATE",
      entityType: "VerificationCase",
      entityId: vc.id,
      afterValues: {
        reference,
        type: data.verificationType,
        employeeId: data.employeeId,
        pensionerId: data.pensionerId,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(vc, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to create verification case", 500);
  }
}
