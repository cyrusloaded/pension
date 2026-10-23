import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { buildAssessmentCode } from "@/lib/payments/parse-schedule-import";
import { assertScheduleMayGenerateAssessment } from "@/lib/payments/srs-enforcement";

type Ctx = { params: Promise<{ id: string }> };

/** SRS: assessment only after DG approval (stage DFA_PAYMENT). */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.SCHEDULE_DFA_PAY) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
  ) {
    return jsonError(
      "Only DFA / payment authorizer may generate assessment after DG approval",
      403
    );
  }

  const { id } = await ctx.params;
  const schedule = await prisma.paymentSchedule.findUnique({
    where: { id },
    include: {
      assessment: true,
      _count: { select: { items: true } },
    },
  });
  if (!schedule) return jsonError("Schedule not found", 404);
  if (schedule.assessment) {
    return jsonOk({
      assessment: schedule.assessment,
      alreadyExists: true,
      url: `/admin/payment-assessments/${schedule.assessment.id}`,
    });
  }

  const guard = assertScheduleMayGenerateAssessment({
    workflowStage: schedule.workflowStage,
    status: schedule.status,
    totalItems: schedule._count.items,
  });
  if (!guard.ok) return jsonError(guard.reason, 400);

  const code = buildAssessmentCode(schedule.paymentPeriod);
  const assessment = await prisma.paymentAssessment.create({
    data: {
      assessmentCode: code,
      scheduleId: schedule.id,
      paymentPeriod: schedule.paymentPeriod,
      description: `SRS payment assessment for ${schedule.scheduleRef} (${schedule.paymentPeriod})`,
      totalAmount: schedule.totalAmount,
      totalItems: schedule.totalItems,
      currency: "NGN",
      status: "READY",
      generatedById: session.id,
      generatedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PAYMENT_ASSESSMENT.GENERATE",
    entityType: "PaymentAssessment",
    entityId: assessment.id,
    afterValues: {
      assessmentCode: code,
      workflowStage: schedule.workflowStage,
      scheduleRef: schedule.scheduleRef,
    },
  });

  return jsonOk({
    assessment,
    url: `/admin/payment-assessments/${assessment.id}`,
  });
}
