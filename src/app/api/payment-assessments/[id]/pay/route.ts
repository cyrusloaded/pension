import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { randomBytes } from "crypto";
import { assertScheduleMayDisburse } from "@/lib/payments/srs-enforcement";

type Ctx = { params: Promise<{ id: string }> };

const GATEWAYS = ["PAYSTACK", "FLUTTERWAVE", "INTERSWITCH", "MANUAL_BANK"] as const;

/**
 * SRS: disbursement only when schedule is at DFA_PAYMENT (after DG approval).
 * BR-07: only confirmed success marks schedule/items paid.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.SCHEDULE_DFA_PAY) &&
    !hasPermission(session, PERMISSIONS.PAYMENTS_AUTHORIZE)
  ) {
    return jsonError("DFA / payment authorizer permission required", 403);
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const method = String(body.method || "").toUpperCase();
  const gateway = String(body.gateway || "MANUAL_BANK").toUpperCase();
  const simulateSuccess = body.simulateSuccess !== false;

  if (!["BANK_TRANSFER", "GATEWAY"].includes(method)) {
    return jsonError("method must be BANK_TRANSFER or GATEWAY", 400);
  }
  if (
    method === "GATEWAY" &&
    !GATEWAYS.includes(gateway as (typeof GATEWAYS)[number])
  ) {
    return jsonError(`Unsupported gateway. Use: ${GATEWAYS.join(", ")}`, 400);
  }

  const assessment = await prisma.paymentAssessment.findUnique({
    where: { id },
    include: { schedule: true },
  });
  if (!assessment) return jsonError("Assessment not found", 404);
  if (assessment.status === "PAID") {
    return jsonError("Assessment already paid", 400);
  }

  const stageGuard = assertScheduleMayDisburse({
    workflowStage: assessment.schedule.workflowStage,
    status: assessment.schedule.status,
  });
  if (!stageGuard.ok) return jsonError(stageGuard.reason, 400);

  if (!["READY", "PAYMENT_INITIATED", "FAILED"].includes(assessment.status)) {
    return jsonError(`Cannot pay assessment in status ${assessment.status}`, 400);
  }

  const externalRef = `${gateway}-${randomBytes(8).toString("hex").toUpperCase()}`;
  const provider = method === "BANK_TRANSFER" ? "MANUAL_BANK" : gateway;

  const tx = await prisma.paymentGatewayTransaction.create({
    data: {
      assessmentId: assessment.id,
      provider,
      externalRef,
      amount: assessment.totalAmount,
      currency: assessment.currency,
      status: simulateSuccess ? "SUCCESS" : "PENDING",
      channel: method === "BANK_TRANSFER" ? "bank_transfer" : "gateway",
      initiatedById: session.id,
      completedAt: simulateSuccess ? new Date() : null,
      rawResponse: {
        demo: true,
        srs: true,
        message: simulateSuccess
          ? "Confirmed disbursement (demo). Replace with live gateway callback for production (BR-07)."
          : "Payment initiated — awaiting provider confirmation",
        method,
        gateway: provider,
      },
    },
  });

  if (simulateSuccess) {
    const paidAt = new Date();
    const receiptRef = `RCPT-${assessment.assessmentCode}`;
    await prisma.$transaction([
      prisma.paymentAssessment.update({
        where: { id },
        data: {
          status: "PAID",
          paymentMethod: method,
          gatewayProvider: provider,
          gatewayRef: externalRef,
          paidAt,
          paidAmount: assessment.totalAmount,
          receiptRef,
        },
      }),
      prisma.paymentSchedule.update({
        where: { id: assessment.scheduleId },
        data: {
          status: "SUCCESSFUL",
          workflowStage: "COMPLETED",
        },
      }),
      prisma.paymentScheduleItem.updateMany({
        where: { scheduleId: assessment.scheduleId },
        data: { status: "PAID", transactionRef: externalRef },
      }),
    ]);

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "PAYMENT_ASSESSMENT.PAID",
      entityType: "PaymentAssessment",
      entityId: id,
      afterValues: {
        method,
        provider,
        externalRef,
        amount: Number(assessment.totalAmount),
        receiptRef,
        workflowStage: "COMPLETED",
      },
    });

    const updated = await prisma.paymentAssessment.findUnique({ where: { id } });
    return jsonOk({
      paid: true,
      assessment: updated,
      transaction: tx,
      message: "Payment recorded on the system after DG/DFA workflow (SRS)",
    });
  }

  await prisma.paymentAssessment.update({
    where: { id },
    data: {
      status: "PAYMENT_INITIATED",
      paymentMethod: method,
      gatewayProvider: provider,
      gatewayRef: externalRef,
    },
  });

  return jsonOk({
    paid: false,
    initiated: true,
    transaction: tx,
    message: "Payment initiated — not confirmed until provider success (BR-07)",
  });
}
