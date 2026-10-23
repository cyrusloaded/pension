import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  jsonOk,
  jsonUnauthorized,
  jsonForbidden,
} from "@/lib/api/response";

/**
 * Approval centre: queues of items awaiting review/authorization.
 */
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonUnauthorized();

  const canSeeBenefits =
    hasPermission(session, PERMISSIONS.BENEFITS_REVIEW) ||
    hasPermission(session, PERMISSIONS.BENEFITS_APPROVE);
  const canSeeRetirements = hasPermission(
    session,
    PERMISSIONS.RETIREMENTS_REVIEW
  );
  const canSeePayments =
    hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) ||
    hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE);
  const canSeeRules = hasPermission(session, PERMISSIONS.SETTINGS_MANAGE);

  if (!canSeeBenefits && !canSeeRetirements && !canSeePayments && !canSeeRules) {
    return jsonForbidden();
  }

  const [
    benefitAssessments,
    retirementCases,
    paymentSchedules,
    ruleVersions,
  ] = await Promise.all([
    canSeeBenefits
      ? prisma.benefitAssessment.findMany({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
          include: {
            retirementCase: {
              select: {
                caseReference: true,
                employee: {
                  select: { staffNumber: true, firstName: true, lastName: true },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
    canSeeRetirements
      ? prisma.retirementCase.findMany({
          where: {
            status: "OPEN",
            currentStage: {
              in: ["CASE_REVIEW", "CALCULATION_REVIEW", "APPROVAL"],
            },
          },
          include: {
            employee: {
              select: { staffNumber: true, firstName: true, lastName: true },
            },
          },
          orderBy: { updatedAt: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
    canSeePayments
      ? prisma.paymentSchedule.findMany({
          where: { status: { in: ["PENDING_REVIEW", "APPROVED"] } },
          orderBy: { createdAt: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
    canSeeRules
      ? prisma.pensionRuleVersion.findMany({
          where: { status: "PENDING_APPROVAL" },
          include: {
            scheme: { select: { name: true, code: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return jsonOk({
    benefitAssessments,
    retirementCases,
    paymentSchedules,
    ruleVersions,
    counts: {
      benefits: benefitAssessments.length,
      retirements: retirementCases.length,
      payments: paymentSchedules.length,
      rules: ruleVersions.length,
    },
  });
}
