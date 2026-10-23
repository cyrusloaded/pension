/**
 * Retirement case workflow state machine.
 * Backend must validate every transition — no arbitrary status changes.
 */

export const RETIREMENT_STAGES = [
  "ELIGIBILITY_ASSESSMENT",
  "NOTIFICATION",
  "APPLICATION",
  "DOCUMENT_SUBMISSION",
  "SERVICE_VERIFICATION",
  "CASE_REVIEW",
  "MISSING_INFO",
  "BENEFIT_ASSESSMENT",
  "CALCULATION_REVIEW",
  "APPROVAL",
  "PENSIONER_ENROLMENT",
  "PAYMENT_PREPARATION",
  "PAYMENT_AUTHORIZATION",
  "DISBURSEMENT",
  "CLOSED",
] as const;

export type RetirementStage = (typeof RETIREMENT_STAGES)[number];

/** Allowed forward / special transitions from each stage */
const TRANSITIONS: Record<RetirementStage, RetirementStage[]> = {
  ELIGIBILITY_ASSESSMENT: ["NOTIFICATION", "CLOSED"],
  NOTIFICATION: ["APPLICATION", "CLOSED"],
  APPLICATION: ["DOCUMENT_SUBMISSION", "CLOSED"],
  DOCUMENT_SUBMISSION: ["SERVICE_VERIFICATION", "MISSING_INFO", "CLOSED"],
  SERVICE_VERIFICATION: ["CASE_REVIEW", "MISSING_INFO", "CLOSED"],
  CASE_REVIEW: [
    "BENEFIT_ASSESSMENT",
    "MISSING_INFO",
    "DOCUMENT_SUBMISSION",
    "CLOSED",
  ],
  MISSING_INFO: [
    "DOCUMENT_SUBMISSION",
    "SERVICE_VERIFICATION",
    "CASE_REVIEW",
    "CLOSED",
  ],
  BENEFIT_ASSESSMENT: ["CALCULATION_REVIEW", "MISSING_INFO", "CLOSED"],
  CALCULATION_REVIEW: [
    "APPROVAL",
    "BENEFIT_ASSESSMENT",
    "MISSING_INFO",
    "CLOSED",
  ],
  APPROVAL: ["PENSIONER_ENROLMENT", "CALCULATION_REVIEW", "CLOSED"],
  PENSIONER_ENROLMENT: ["PAYMENT_PREPARATION", "CLOSED"],
  PAYMENT_PREPARATION: ["PAYMENT_AUTHORIZATION", "CLOSED"],
  PAYMENT_AUTHORIZATION: ["DISBURSEMENT", "PAYMENT_PREPARATION", "CLOSED"],
  DISBURSEMENT: ["CLOSED"],
  CLOSED: [],
};

/** Permissions typically required to advance from a stage */
export const STAGE_PERMISSIONS: Partial<Record<RetirementStage, string>> = {
  ELIGIBILITY_ASSESSMENT: "retirements.create",
  NOTIFICATION: "retirements.review",
  APPLICATION: "retirements.create",
  DOCUMENT_SUBMISSION: "retirements.review",
  SERVICE_VERIFICATION: "verification.manage",
  CASE_REVIEW: "retirements.review",
  MISSING_INFO: "retirements.review",
  BENEFIT_ASSESSMENT: "benefits.calculate",
  CALCULATION_REVIEW: "benefits.review",
  APPROVAL: "benefits.approve",
  PENSIONER_ENROLMENT: "pensioners.create",
  PAYMENT_PREPARATION: "payments.prepare",
  PAYMENT_AUTHORIZATION: "payments.authorize",
  DISBURSEMENT: "payments.authorize",
};

export function canTransition(
  from: RetirementStage,
  to: RetirementStage
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(
  from: RetirementStage
): RetirementStage[] {
  return TRANSITIONS[from] ?? [];
}

export function stageLabel(stage: string): string {
  return stage
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export const REQUIRED_DOCUMENTS = [
  { code: "APPOINTMENT_LETTER", label: "Appointment letter" },
  { code: "CONFIRMATION_LETTER", label: "Confirmation letter" },
  { code: "SERVICE_RECORD", label: "Service record / history" },
  { code: "IDENTITY_DOCUMENT", label: "National ID / passport" },
  { code: "BIRTH_EVIDENCE", label: "Evidence of date of birth" },
  { code: "LAST_PAY_SLIP", label: "Last pay slip" },
  { code: "BANK_DETAILS", label: "Bank account evidence" },
  { code: "RETIREMENT_NOTICE", label: "Retirement notice / application" },
] as const;
