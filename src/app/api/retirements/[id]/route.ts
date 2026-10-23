import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  jsonOk,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
} from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();
  if (
    !hasPermission(session, PERMISSIONS.RETIREMENTS_READ) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_CREATE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_REVIEW)
  ) {
    return jsonForbidden();
  }

  const { id } = await params;
  const retirementCase = await prisma.retirementCase.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          organization: true,
          serviceHistory: { orderBy: { startDate: "desc" }, take: 10 },
          salaryHistory: { orderBy: { effectiveDate: "desc" }, take: 5 },
        },
      },
      pensionScheme: true,
      assignedOfficer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      timeline: { orderBy: { createdAt: "asc" } },
      assessments: {
        orderBy: { createdAt: "desc" },
        include: {
          ruleVersion: { select: { version: true, name: true } },
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

  if (!retirementCase) return jsonNotFound("Retirement case not found");
  return jsonOk(retirementCase);
}
