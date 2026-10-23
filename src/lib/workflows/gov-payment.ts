/**
 * Map legacy payment status machine ↔ government workflow stages (SRS).
 */
import {
  canAdvanceGovWorkflow,
  type GovWorkflowStage,
} from "@/lib/payments/business-rules";

/** When workflow advances, mirror a compatible PaymentSchedule.status */
export function statusForWorkflowStage(stage: string): string {
  switch (stage) {
    case "PREPARATION":
      return "DRAFT";
    case "INTERNAL_AUDIT":
      return "PENDING_REVIEW";
    case "DG_APPROVAL":
      return "APPROVED";
    case "DFA_PAYMENT":
      return "AUTHORIZED";
    case "COMPLETED":
      return "SUCCESSFUL";
    case "RETURNED":
      return "DRAFT";
    case "REJECTED":
      return "CANCELLED";
    default:
      return "DRAFT";
  }
}

export function assertGovTransition(from: string, to: string) {
  if (!canAdvanceGovWorkflow(from, to)) {
    throw new Error(`Invalid workflow move: ${from} → ${to}`);
  }
}

export type { GovWorkflowStage };
