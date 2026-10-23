import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { employeeUpdateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
} from "@/lib/api/response";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_READ)) {
    return jsonForbidden();
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      organization: true,
      pensionScheme: true,
      serviceHistory: { orderBy: { startDate: "desc" } },
      salaryHistory: { orderBy: { effectiveDate: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      retirementCases: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          caseReference: true,
          currentStage: true,
          status: true,
          expectedRetirementDate: true,
        },
      },
      pensioner: {
        select: {
          id: true,
          pensionerNumber: true,
          paymentStatus: true,
          monthlyPension: true,
        },
      },
    },
  });

  if (!employee) return jsonNotFound("Employee not found");
  return jsonOk(employee);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_UPDATE)) {
    return jsonForbidden();
  }

  const { id } = await params;
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return jsonNotFound("Employee not found");

  try {
    const body = await req.json();
    const parsed = employeeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error.flatten());
    }

    const data = parsed.data;

    if (data.staffNumber && data.staffNumber !== existing.staffNumber) {
      const clash = await prisma.employee.findUnique({
        where: { staffNumber: data.staffNumber },
      });
      if (clash) return jsonError("Staff number already in use", 409);
    }

    if (data.nin && data.nin !== existing.nin) {
      const clash = await prisma.employee.findFirst({
        where: { nin: data.nin, NOT: { id } },
      });
      if (clash) return jsonError("NIN already registered", 409);
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      "title",
      "firstName",
      "lastName",
      "middleName",
      "gender",
      "maritalStatus",
      "nationality",
      "stateOfOrigin",
      "lgaOfOrigin",
      "phone",
      "email",
      "residentialAddress",
      "permanentAddress",
      "organizationId",
      "employmentCategory",
      "jobTitle",
      "gradeLevel",
      "step",
      "employmentStatus",
      "pensionSchemeId",
      "nextOfKinName",
      "nextOfKinPhone",
      "nextOfKinRelationship",
      "staffNumber",
      "nin",
    ] as const;

    for (const f of fields) {
      if (data[f] !== undefined) {
        updateData[f] = data[f] === "" ? null : data[f];
      }
    }
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = parseDate(data.dateOfBirth);
    }
    if (data.appointmentDate !== undefined) {
      updateData.appointmentDate = parseDate(data.appointmentDate);
    }
    if (data.confirmationDate !== undefined) {
      updateData.confirmationDate = parseDate(data.confirmationDate);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true, code: true } },
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "EMPLOYEE.UPDATE",
      entityType: "Employee",
      entityId: id,
      beforeValues: {
        staffNumber: existing.staffNumber,
        employmentStatus: existing.employmentStatus,
        gradeLevel: existing.gradeLevel,
      },
      afterValues: {
        staffNumber: employee.staffNumber,
        employmentStatus: employee.employmentStatus,
        gradeLevel: employee.gradeLevel,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(employee);
  } catch (e) {
    console.error("Update employee error:", e);
    return jsonError("Failed to update employee", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_ARCHIVE)) {
    return jsonForbidden();
  }

  const { id } = await params;
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return jsonNotFound("Employee not found");
  if (existing.isArchived) {
    return jsonError("Employee is already archived", 400);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : "Archived by officer";

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        isArchived: true,
        employmentStatus: "ARCHIVED",
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "EMPLOYEE.ARCHIVE",
      entityType: "Employee",
      entityId: id,
      beforeValues: {
        isArchived: false,
        employmentStatus: existing.employmentStatus,
      },
      afterValues: { isArchived: true, employmentStatus: "ARCHIVED" },
      reason,
      outcome: "SUCCESS",
    });

    return jsonOk({ id: employee.id, isArchived: true });
  } catch (e) {
    console.error(e);
    return jsonError("Failed to archive employee", 500);
  }
}
