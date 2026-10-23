import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { serviceHistorySchema } from "@/lib/validation/schemas";
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
    const parsed = serviceHistorySchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const data = parsed.data;
    const startDate = new Date(data.startDate);
    if (Number.isNaN(startDate.getTime())) {
      return jsonError("Invalid start date", 400);
    }

    const entry = await prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.serviceHistory.updateMany({
          where: { employeeId, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      return tx.serviceHistory.create({
        data: {
          employeeId,
          organizationId: data.organizationId || null,
          jobTitle: data.jobTitle || null,
          gradeLevel: data.gradeLevel || null,
          step: data.step ?? null,
          startDate,
          endDate: data.endDate ? new Date(data.endDate) : null,
          reason: data.reason || null,
          remarks: data.remarks || null,
          isCurrent: data.isCurrent,
        },
      });
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "EMPLOYEE.SERVICE_HISTORY_ADD",
      entityType: "ServiceHistory",
      entityId: entry.id,
      afterValues: { employeeId, jobTitle: entry.jobTitle, startDate: entry.startDate },
      outcome: "SUCCESS",
    });

    return jsonOk(entry, 201);
  } catch (e) {
    console.error(e);
    return jsonError("Failed to add service history", 500);
  }
}
