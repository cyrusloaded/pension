import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { employeeCreateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
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
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_READ)) {
    return jsonForbidden();
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const organizationId = searchParams.get("organizationId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
  );

  const where: Record<string, unknown> = { isArchived: false };
  if (q) {
    where.OR = [
      { staffNumber: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { nin: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.employmentStatus = status;
  if (organizationId) where.organizationId = organizationId;

  // Organizational boundary for non-super roles
  if (
    session.organizationId &&
    !session.roles.includes("SUPER_ADMIN") &&
    !session.roles.includes("SYSTEM_ADMIN") &&
    !session.roles.includes("PENSION_DIRECTOR")
  ) {
    where.organizationId = session.organizationId;
  }

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, code: true } },
        pensionScheme: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_CREATE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = employeeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const data = parsed.data;

    const duplicate = await prisma.employee.findFirst({
      where: {
        OR: [
          { staffNumber: data.staffNumber },
          ...(data.nin ? [{ nin: data.nin }] : []),
        ],
      },
    });
    if (duplicate) {
      return jsonError(
        duplicate.staffNumber === data.staffNumber
          ? "Staff number already exists"
          : "NIN already registered to another employee",
        409
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });
    if (!org) return jsonError("Organization not found", 400);

    if (data.pensionSchemeId) {
      const scheme = await prisma.pensionScheme.findUnique({
        where: { id: data.pensionSchemeId },
      });
      if (!scheme) return jsonError("Pension scheme not found", 400);
    }

    const dob = parseDate(data.dateOfBirth);
    if (!dob) return jsonError("Invalid date of birth", 400);

    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          staffNumber: data.staffNumber,
          title: data.title || null,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName || null,
          dateOfBirth: dob,
          gender: data.gender || null,
          maritalStatus: data.maritalStatus || null,
          nationality: data.nationality || "Nigerian",
          stateOfOrigin: data.stateOfOrigin || null,
          lgaOfOrigin: data.lgaOfOrigin || null,
          nin: data.nin || null,
          phone: data.phone || null,
          email: data.email || null,
          residentialAddress: data.residentialAddress || null,
          permanentAddress: data.permanentAddress || null,
          organizationId: data.organizationId,
          employmentCategory: data.employmentCategory || null,
          appointmentDate: parseDate(data.appointmentDate),
          confirmationDate: parseDate(data.confirmationDate),
          jobTitle: data.jobTitle || null,
          gradeLevel: data.gradeLevel || null,
          step: data.step ?? null,
          employmentStatus: data.employmentStatus,
          pensionSchemeId: data.pensionSchemeId || null,
          nextOfKinName: data.nextOfKinName || null,
          nextOfKinPhone: data.nextOfKinPhone || null,
          nextOfKinRelationship: data.nextOfKinRelationship || null,
          createdById: session.id,
        },
        include: {
          organization: { select: { id: true, name: true, code: true } },
        },
      });

      if (data.appointmentDate && data.jobTitle) {
        await tx.serviceHistory.create({
          data: {
            employeeId: emp.id,
            organizationId: data.organizationId,
            jobTitle: data.jobTitle,
            gradeLevel: data.gradeLevel || null,
            step: data.step ?? null,
            startDate: parseDate(data.appointmentDate)!,
            isCurrent: true,
            reason: "Initial appointment",
          },
        });
      }

      return emp;
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "EMPLOYEE.CREATE",
      entityType: "Employee",
      entityId: employee.id,
      afterValues: {
        staffNumber: employee.staffNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        organizationId: employee.organizationId,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(employee, 201);
  } catch (e) {
    console.error("Create employee error:", e);
    return jsonError("Failed to create employee", 500);
  }
}
