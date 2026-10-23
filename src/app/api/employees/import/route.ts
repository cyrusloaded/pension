import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { writeAuditLog } from "@/lib/audit/logger";
import { importEmployees } from "@/lib/import/employees";
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonForbidden,
  jsonValidationError,
} from "@/lib/api/response";

const rowSchema = z.object({
  staffNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  organizationCode: z.string().min(1),
  jobTitle: z.string().optional().nullable(),
  gradeLevel: z.string().optional().nullable(),
  employmentStatus: z.string().optional().nullable(),
  nin: z.string().optional().nullable(),
  appointmentDate: z.string().optional().nullable(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (!hasPermission(session, PERMISSIONS.EMPLOYEES_CREATE)) {
    return jsonForbidden();
  }

  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonValidationError(parsed.error.flatten());

    const summary = await importEmployees(parsed.data.rows, session.id);

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "EMPLOYEE.BULK_IMPORT",
      entityType: "Employee",
      afterValues: {
        total: summary.total,
        created: summary.created,
        skippedDuplicates: summary.skippedDuplicates,
        errors: summary.errors,
      },
      outcome: "SUCCESS",
    });

    return jsonOk(summary);
  } catch (e) {
    console.error("Bulk import error:", e);
    return jsonError("Bulk import failed", 500);
  }
}
