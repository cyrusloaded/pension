/**
 * Core business rules from Civil Service Pension SRS (BR-01 … BR-14).
 */

import { Decimal } from "@prisma/client/runtime/library";

/** BR-08: statuses excluded from ordinary monthly disbursement */
export const BLOCKED_PAYMENT_STATUSES = [
  "SUSPENDED",
  "STOPPED",
  "DECEASED",
  "PENDING",
] as const;

export const BLOCKED_PLACEMENT_STATUSES = [
  "NEW_PLACEMENT",
  "INACTIVE",
  "DECEASED",
  "SUSPENDED",
] as const;

export function isEligibleForMonthlyPension(p: {
  isActive: boolean;
  paymentStatus: string;
  placementStatus?: string | null;
}): boolean {
  if (!p.isActive) return false;
  if (p.paymentStatus !== "ACTIVE") return false;
  const placement = p.placementStatus ?? "ACTIVE";
  if (placement !== "ACTIVE") return false;
  return true;
}

/** BR-04: outstanding gratuity from confirmed (PAID) installments only */
export function outstandingGratuity(
  approvedAmount: number | Decimal,
  installments: { status: string; paidAmount?: number | Decimal | null; proposedAmount?: number | Decimal | null }[]
): number {
  const approved = Number(approvedAmount);
  const paid = installments
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + Number(i.paidAmount ?? i.proposedAmount ?? 0), 0);
  return Math.max(0, roundMoney(approved - paid));
}

/** BR-05: proposed payment cannot exceed verified available balance */
export function canProposeGratuityPayment(
  outstanding: number,
  proposed: number
): { ok: boolean; reason?: string } {
  if (proposed <= 0) return { ok: false, reason: "Amount must be positive" };
  if (proposed > outstanding + 0.001) {
    return {
      ok: false,
      reason: `Proposed ₦${proposed.toLocaleString()} exceeds outstanding ₦${outstanding.toLocaleString()}`,
    };
  }
  return { ok: true };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * BR-06 / separation of duties:
 * Preparer cannot be the sole internal auditor or DG approver on the same schedule.
 */
export function violatesSeparationOfDuties(opts: {
  preparedById?: string | null;
  actorId: string;
  action: "INTERNAL_AUDIT" | "DG_APPROVAL" | "DFA_PAYMENT";
}): { ok: boolean; reason?: string } {
  if (
    opts.preparedById &&
    opts.preparedById === opts.actorId &&
    (opts.action === "INTERNAL_AUDIT" || opts.action === "DG_APPROVAL")
  ) {
    return {
      ok: false,
      reason:
        "Separation of duties: you prepared this schedule and cannot audit or grant final approval on it",
    };
  }
  return { ok: true };
}

/** Government four-stage workflow (SRS §4 Workflow B/C) */
export const GOV_WORKFLOW_STAGES = [
  "PREPARATION",
  "INTERNAL_AUDIT",
  "DG_APPROVAL",
  "DFA_PAYMENT",
  "COMPLETED",
  "RETURNED",
  "REJECTED",
] as const;

export type GovWorkflowStage = (typeof GOV_WORKFLOW_STAGES)[number];

const GOV_TRANSITIONS: Record<GovWorkflowStage, GovWorkflowStage[]> = {
  PREPARATION: ["INTERNAL_AUDIT", "REJECTED"],
  INTERNAL_AUDIT: ["DG_APPROVAL", "RETURNED", "REJECTED"],
  DG_APPROVAL: ["DFA_PAYMENT", "RETURNED", "REJECTED"],
  DFA_PAYMENT: ["COMPLETED", "RETURNED"],
  COMPLETED: [],
  RETURNED: ["PREPARATION", "INTERNAL_AUDIT"],
  REJECTED: [],
};

export function canAdvanceGovWorkflow(
  from: string,
  to: string
): boolean {
  const f = from as GovWorkflowStage;
  const t = to as GovWorkflowStage;
  return GOV_TRANSITIONS[f]?.includes(t) ?? false;
}
