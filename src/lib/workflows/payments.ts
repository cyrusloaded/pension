/**
 * Payment schedule status machine.
 * Transitions are enforced on the server.
 */

export const PAYMENT_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "AUTHORIZED",
  "SUBMITTED",
  "PROCESSING",
  "SUCCESSFUL",
  "FAILED",
  "RECONCILED",
  "CANCELLED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "CANCELLED"],
  PENDING_REVIEW: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["AUTHORIZED", "DRAFT", "CANCELLED"],
  AUTHORIZED: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["PROCESSING", "FAILED"],
  PROCESSING: ["SUCCESSFUL", "FAILED"],
  SUCCESSFUL: ["RECONCILED"],
  FAILED: ["DRAFT", "CANCELLED"],
  RECONCILED: [],
  CANCELLED: [],
};

export function canTransitionPayment(
  from: PaymentStatus,
  to: PaymentStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedPaymentTransitions(
  from: PaymentStatus
): PaymentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function paymentStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
