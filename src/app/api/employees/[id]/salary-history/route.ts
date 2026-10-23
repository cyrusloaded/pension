import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { salaryHistorySchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
} from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_UPDATE)) {
    return jsonForbidden();
  }

  const { id: employeeId } = await params;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return jsonNotFound("Employee not found");

  try {
    const body = await req.json();
    const parsed = salaryHistorySchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;
    const effectiveDate = new Date(data.effectiveDate);
    if (Number.isNaN(effectiveDate.getTime())) {
      return jsonError("Invalid effective date", 400);
    }

    const total =
      data.totalEmolument ??
      data.basicSalary + (data.allowances ?? 0);

    const entry = await prisma.salaryHistory.create({
      data: {
        employeeId,
        gradeLevel: data.gradeLevel,
        step: data.step ?? null,
        basicSalary: data.basicSalary,
        allowances: data.allowances ?? null,
        totalEmolument: total,
        effectiveDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        remarks: data.remarks || null,
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "EMPLOYEE.SALARY_HISTORY_ADD",
      entityType: "SalaryHistory",
      entityId: entry.id,
      afterValues: {
        employeeId,
        gradeLevel: entry.gradeLevel,
        basicSalary: Number(entry.basicSalary),
        effectiveDate: entry.effectiveDate,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(entry, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to add salary history", 500);
  }
}
