import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";

/**
 * Flutterwave webhook (BR-07).
 * Env: FLUTTERWAVE_SECRET_HASH, PAYMENT_GATEWAY_MODE=demo|live
 */
export async function POST(req: NextRequest) {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || "";
  const mode = (process.env.PAYMENT_GATEWAY_MODE || "demo").toLowerCase();
  const headerHash = req.headers.get("verif-hash") || "";

  if (secretHash) {
    if (headerHash !== secretHash) {
      return jsonError("Invalid verif-hash", 401);
    }
  } else if (mode !== "demo") {
    return jsonError("Flutterwave secret hash not configured", 503);
  }

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);

  const status = String(body.status || body.data?.status || "").toLowerCase();
  const txRef = body.txRef || body.tx_ref || body.data?.tx_ref;
  const meta = body.meta || body.data?.meta || {};
  const assessmentCode = meta.assessmentCode;

  if (status !== "successful" && status !== "success") {
    return jsonOk({ received: true, handled: false });
  }

  const assessment = await prisma.paymentAssessment.findFirst({
    where: assessmentCode
      ? { assessmentCode }
      : txRef
        ? { gatewayRef: String(txRef) }
        : { id: "___none___" },
  });

  if (!assessment) {
    return jsonOk({
      received: true,
      handled: false,
      reason: "assessment not found",
    });
  }
  if (assessment.status === "PAID") {
    return jsonOk({ received: true, handled: true, alreadyPaid: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentAssessment.update({
      where: { id: assessment.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        gatewayRef: txRef ? String(txRef) : assessment.gatewayRef,
        gatewayProvider: "FLUTTERWAVE",
        paidAmount: assessment.totalAmount,
        paymentMethod: "GATEWAY",
      },
    });
    await tx.paymentScheduleItem.updateMany({
      where: { scheduleId: assessment.scheduleId, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
    await tx.paymentSchedule.update({
      where: { id: assessment.scheduleId },
      data: { status: "COMPLETED", workflowStage: "COMPLETED" },
    });
    await tx.paymentGatewayTransaction.create({
      data: {
        assessmentId: assessment.id,
        provider: "FLUTTERWAVE",
        externalRef: txRef ? String(txRef) : `FW-${Date.now()}`,
        amount: assessment.totalAmount,
        status: "SUCCESS",
        channel: "gateway",
        rawResponse: body as object,
        completedAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    actorEmail: "flutterwave-webhook",
    action: "PAYMENT.WEBHOOK_FLUTTERWAVE",
    entityType: "PaymentAssessment",
    entityId: assessment.id,
    afterValues: { txRef, status: "PAID" },
  });

  return jsonOk({ received: true, handled: true });
}
