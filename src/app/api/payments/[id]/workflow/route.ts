import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  canAdvanceGovWorkflow,
  violatesSeparationOfDuties,
} from "@/lib/payments/business-rules";
import { statusForWorkflowStage } from "@/lib/workflows/gov-payment";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;
  const body = await req.json();
  const toStage = String(body.toStage || "");
  const decision = body.decision ? String(body.decision) : null;
  const remarks = body.remarks ? String(body.remarks) : null;

  const schedule = await prisma.paymentSchedule.findUnique({ where: { id } });
  if (!schedule) return jsonError("Schedule not found", 404);

  const from = schedule.workflowStage || "PREPARATION";
  if (!canAdvanceGovWorkflow(from, toStage)) {
    return jsonError(`Cannot move from ${from} to ${toStage}`, 400);
  }

  if (toStage === "INTERNAL_AUDIT") {
    if (!hasPermission(session, PERMISSIONS.PAYMENTS_PREPARE)) {
      return jsonError("Prepare permission required to submit for audit", 403);
    }
  }
  if (toStage === "DG_APPROVAL") {
    if (
      !hasPermission(session, PERMISSIONS.SCHEDULE_AUDIT) &&
      !hasPermission(session, PERMISSIONS.AUDIT_READ)
    ) {
      return jsonError("Internal audit permission required", 403);
    }
    const sod = violatesSeparationOfDuties({
      preparedById: schedule.preparedById,
      actorId: session.id,
      action: "INTERNAL_AUDIT",
    });
    if (!sod.ok) return jsonError(sod.reason!, 403);
  }
  if (toStage === "DFA_PAYMENT") {
    if (
      !hasPermission(session, PERMISSIONS.SCHEDULE_DG_APPROVE) &&
      !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE) &&
      !hasPermission(session, PERMISSIONS.BENEFITS_APPROVE)
    ) {
      return jsonError("DG approval permission required", 403);
    }
    const sod = violatesSeparationOfDuties({
      preparedById: schedule.preparedById,
      actorId: session.id,
      action: "DG_APPROVAL",
    });
    if (!sod.ok) return jsonError(sod.reason!, 403);
  }
  if (toStage === "COMPLETED") {
    if (
      !hasPermission(session, PERMISSIONS.SCHEDULE_DFA_PAY) &&
      !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
    ) {
      return jsonError("DFA payment permission required", 403);
    }
  }

  const data: Record<string, unknown> = {
    workflowStage: toStage,
    status: statusForWorkflowStage(toStage),
  };

  if (toStage === "DG_APPROVAL") {
    data.auditedById = session.id;
    data.auditedAt = new Date();
    data.auditRemarks = remarks;
    data.auditDecision = decision || "RECOMMEND_APPROVE";
  }
  if (toStage === "DFA_PAYMENT") {
    data.dgApprovedById = session.id;
    data.dgApprovedAt = new Date();
    data.dgRemarks = remarks;
    data.dgDecision = decision || "APPROVED";
    data.approvedById = session.id;
    data.approvedAt = new Date();
  }
  if (toStage === "COMPLETED") {
    data.dfaReceivedById = session.id;
    data.dfaReceivedAt = new Date();
    data.authorizedById = session.id;
    data.authorizedAt = new Date();
  }
  if (toStage === "INTERNAL_AUDIT") {
    data.preparedById = schedule.preparedById || session.id;
    data.preparedAt = schedule.preparedAt || new Date();
  }
  if (toStage === "RETURNED" || toStage === "REJECTED") {
    data.notes = [schedule.notes, remarks].filter(Boolean).join("\n");
  }

  const updated = await prisma.paymentSchedule.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    action: "PAYMENT_SCHEDULE.WORKFLOW",
    entityType: "PaymentSchedule",
    entityId: id,
    afterValues: { from, to: toStage, decision, remarks },
  });

  return jsonOk({ schedule: updated });
}
