import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { retirementCreateSchema } from "@/lib/validation/schemas";
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
    !hasPermission(session, PERMISSIONS.RETIREMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW)
  ) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const stage = searchParams.get("stage");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
  );

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { caseReference: { contains: q, mode: "insensitive" } },
      {
        employee: {
          OR: [
            { staffNumber: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  if (stage) where.currentStage = stage;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.retirementCase.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            staffNumber: true,
            firstName: true,
            lastName: true,
            organization: { select: { name: true, code: true } },
          },
        },
        assignedOfficer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        pensionScheme: { select: { id: true, name: true, code: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.retirementCase.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = retirementCreateSchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;

    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: {
        retirementCases: {
          where: { status: "OPEN" },
          select: { id: true, caseReference: true },
        },
      },
    });
    if (!employee) return jsonError("Employee not found", 400);
    if (employee.employmentStatus === "RETIRED") {
      return jsonError("Employee is already marked as retired", 400);
    }
    if (employee.retirementCases.length > 0) {
      return jsonError(
        `Employee already has an open retirement case (${employee.retirementCases[0].caseReference})`,
        409
      );
    }

    if (data.pensionSchemeId) {
      const scheme = await prisma.pensionScheme.findUnique({
        where: { id: data.pensionSchemeId },
      });
      if (!scheme) return jsonError("Pension scheme not found", 400);
    }

    const caseReference = generateReference("RET");

    const retirementCase = await prisma.$transaction(async (tx) => {
      const rc = await tx.retirementCase.create({
        data: {
          caseReference,
          employeeId: data.employeeId,
          pensionSchemeId:
            data.pensionSchemeId || employee.pensionSchemeId || null,
          retirementCategory: data.retirementCategory || null,
          expectedRetirementDate: parseDate(data.expectedRetirementDate),
          notes: data.notes || null,
          assignedOfficerId: data.assignedOfficerId || session.id,
          currentStage: "ELIGIBILITY_ASSESSMENT",
          status: "OPEN",
          createdById: session.id,
        },
        include: {
          employee: {
            select: {
              staffNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await tx.retirementTimeline.create({
        data: {
          retirementCaseId: rc.id,
          stage: "ELIGIBILITY_ASSESSMENT",
          action: "CASE_CREATED",
          performedById: session.id,
          comments: data.notes || "Retirement case initiated",
        },
      });

      return rc;
    });

    if (data.assignedOfficerId && data.assignedOfficerId !== session.id) {
      await createNotification({
        userId: data.assignedOfficerId,
        title: "Retirement case assigned",
        message: `Case ${caseReference} for ${retirementCase.employee.lastName}, ${retirementCase.employee.firstName} has been assigned to you.`,
        type: "ASSIGNMENT",
        link: `/admin/retirements/${retirementCase.id}`,
      });
    }

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "RETIREMENT.CREATE",
      entityType: "RetirementCase",
      entityId: retirementCase.id,
      afterValues: {
        caseReference,
        employeeId: data.employeeId,
        stage: "ELIGIBILITY_ASSESSMENT",
      },
      outcome: "SUCCESS",
    });

    return jsonOk(retirementCase, 201);
  } catch (e) {
    console.error("Create retirement case error:", e);
    return jsonError("Failed to create retirement case", 500);
  }
}
