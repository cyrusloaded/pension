import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/database/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Paystack webhook — confirms gateway success (BR-07).
 * Env: PAYSTACK_SECRET_KEY, PAYMENT_GATEWAY_MODE=demo|live
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.PAYSTACK_SECRET_KEY || "";
  const mode = (process.env.PAYMENT_GATEWAY_MODE || "demo").toLowerCase();

  if (secret) {
    const signature = req.headers.get("x-paystack-signature") || "";
    const hash = createHmac("sha512", secret).update(raw).digest("hex");
    try {
      const a = Buffer.from(hash);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return jsonError("Invalid signature", 401);
      }
    } catch {
      return jsonError("Invalid signature", 401);
    }
  } else if (mode !== "demo") {
    return jsonError("Paystack secret not configured", 503);
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      metadata?: { assessmentCode?: string };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  if (event.event !== "charge.success" && event.data?.status !== "success") {
    return jsonOk({ received: true, handled: false });
  }

  const reference = event.data?.reference;
  const assessmentCode = event.data?.metadata?.assessmentCode;
  if (!reference && !assessmentCode) {
    return jsonOk({ received: true, handled: false, reason: "no reference" });
  }

  const assessment = await prisma.paymentAssessment.findFirst({
    where: assessmentCode
      ? { assessmentCode }
      : { gatewayRef: reference },
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
        gatewayRef: reference || assessment.gatewayRef,
        gatewayProvider: "PAYSTACK",
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
        provider: "PAYSTACK",
        externalRef: reference || `PS-${Date.now()}`,
        amount: assessment.totalAmount,
        status: "SUCCESS",
        channel: "gateway",
        rawResponse: event as object,
        completedAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    actorEmail: "paystack-webhook",
    action: "PAYMENT.WEBHOOK_PAYSTACK",
    entityType: "PaymentAssessment",
    entityId: assessment.id,
    afterValues: { reference, status: "PAID" },
  });

  return jsonOk({ received: true, handled: true, assessmentId: assessment.id });
}
