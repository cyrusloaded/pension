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
    !hasPermission(session, PERMISSIONS.BENEFITS_CALCULATE) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) &&
    !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE) &&
    !hasPermission(session, PERMISSIONS.RETIREMENTS_READ)
  ) {
    return jsonForbidden();
  }

  const { id } = await params;
  const assessment = await prisma.benefitAssessment.findUnique({
    where: { id },
    include: {
      retirementCase: {
        include: {
          employee: {
            include: {
              organization: true,
              salaryHistory: { orderBy: { effectiveDate: "desc" }, take: 3 },
              serviceHistory: { orderBy: { startDate: "desc" }, take: 5 },
            },
          },
          pensionScheme: true,
        },
      },
      ruleVersion: true,
    },
  });

  if (!assessment) return jsonNotFound("Benefit assessment not found");
  return jsonOk(assessment);
}
