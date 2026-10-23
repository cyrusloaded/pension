/**
 * Strict Civil Service Pension SRS enforcement.
 * All payment and gratuity paths must call these guards.
 */

import { prisma } from "@/lib/database/prisma";
import { isEligibleForMonthlyPension } from "@/lib/payments/business-rules";

/** Stages that may generate a payable assessment or execute disbursement */
export const STAGES_ALLOWED_TO_PAY = ["DFA_PAYMENT", "COMPLETED"] as const;

/** Stages after which DG has approved (DFA may act) */
export const STAGES_AFTER_DG = ["DFA_PAYMENT", "COMPLETED"] as const;

export function assertScheduleMayGenerateAssessment(schedule: {
  workflowStage: string | null;
  status: string;
  totalItems: number;
}): { ok: true } | { ok: false; reason: string } {
  if (schedule.totalItems <= 0) {
    return { ok: false, reason: "Schedule has no line items (BR-14)" };
  }
  const stage = schedule.workflowStage || "PREPARATION";
  // SRS: only after DG final approval may finance generate payable assessment
  if (!STAGES_AFTER_DG.includes(stage as (typeof STAGES_AFTER_DG)[number])) {
    return {
      ok: false,
      reason: `SRS: assessment/payment only after DG approval. Current stage is ${stage}. Advance: PREPARATION → INTERNAL_AUDIT → DG_APPROVAL → DFA_PAYMENT.`,
    };
  }
  if (["CANCELLED", "REJECTED"].includes(schedule.status) || stage === "REJECTED") {
    return { ok: false, reason: "Rejected/cancelled schedules cannot be paid" };
  }
  return { ok: true };
}

export function assertScheduleMayDisburse(schedule: {
  workflowStage: string | null;
  status: string;
}): { ok: true } | { ok: false; reason: string } {
  const stage = schedule.workflowStage || "PREPARATION";
  if (!STAGES_ALLOWED_TO_PAY.includes(stage as (typeof STAGES_ALLOWED_TO_PAY)[number])) {
    return {
      ok: false,
      reason: `SRS: disbursement only at DFA_PAYMENT stage. Current stage: ${stage}`,
    };
  }
  return { ok: true };
}

/** BR-08 / BR-01 eligibility for a monthly schedule line */
export async function loadEligiblePensionerForMonthly(pensionerNumber: string) {
  const p = await prisma.pensioner.findUnique({
    where: { pensionerNumber },
    select: {
      id: true,
      pensionerNumber: true,
      isActive: true,
      paymentStatus: true,
      placementStatus: true,
      bankName: true,
      bankAccountNumber: true,
      monthlyPension: true,
    },
  });
  if (!p) return { ok: false as const, reason: "Pensioner not found (BR-01)" };
  if (
    !isEligibleForMonthlyPension({
      isActive: p.isActive,
      paymentStatus: p.paymentStatus,
      placementStatus: p.placementStatus,
    })
  ) {
    return {
      ok: false as const,
      reason: `Not eligible for ordinary monthly pension (status=${p.paymentStatus}, placement=${p.placementStatus || "—"}) — BR-08`,
    };
  }
  return { ok: true as const, pensioner: p };
}

/**
 * BR-11 style: block if this pensioner already has a PAID item
 * on a non-cancelled schedule for the same payment period.
 */
export async function hasDuplicatePaidMonthly(
  pensionerId: string,
  paymentPeriod: string
): Promise<boolean> {
  const hit = await prisma.paymentScheduleItem.findFirst({
    where: {
      pensionerId,
      status: "PAID",
      schedule: {
        paymentPeriod,
        paymentType: { in: ["MONTHLY_PENSION", "MIXED"] },
        status: { notIn: ["CANCELLED"] },
      },
    },
    select: { id: true },
  });
  return !!hit;
}

export async function assertNoDuplicatePaidMonthly(
  pensionerId: string,
  paymentPeriod: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (await hasDuplicatePaidMonthly(pensionerId, paymentPeriod)) {
    return {
      ok: false,
      reason: `Duplicate payment risk: pensioner already has a PAID monthly item for ${paymentPeriod} (BR-11)`,
    };
  }
  return { ok: true };
}
