import { describe, it, expect } from "vitest";
import {
  isEligibleForMonthlyPension,
  outstandingGratuity,
  canProposeGratuityPayment,
  canAdvanceGovWorkflow,
  violatesSeparationOfDuties,
} from "../src/lib/payments/business-rules";
import {
  assertScheduleMayGenerateAssessment,
  assertScheduleMayDisburse,
} from "../src/lib/payments/srs-enforcement";

describe("SRS eligibility BR-08", () => {
  it("blocks NEW_PLACEMENT", () => {
    expect(
      isEligibleForMonthlyPension({
        isActive: true,
        paymentStatus: "PENDING",
        placementStatus: "NEW_PLACEMENT",
      })
    ).toBe(false);
  });
  it("allows ACTIVE", () => {
    expect(
      isEligibleForMonthlyPension({
        isActive: true,
        paymentStatus: "ACTIVE",
        placementStatus: "ACTIVE",
      })
    ).toBe(true);
  });
});

describe("SRS workflow stage gates", () => {
  it("rejects assessment before DFA", () => {
    expect(() =>
      assertScheduleMayGenerateAssessment({
        workflowStage: "DG_APPROVAL",
        status: "APPROVED",
      })
    ).toThrow();
  });
  it("allows assessment at DFA_PAYMENT", () => {
    expect(() =>
      assertScheduleMayGenerateAssessment({
        workflowStage: "DFA_PAYMENT",
        status: "APPROVED",
      })
    ).not.toThrow();
  });
  it("rejects pay before DFA", () => {
    expect(() =>
      assertScheduleMayDisburse({
        workflowStage: "INTERNAL_AUDIT",
        status: "PENDING_APPROVAL",
      })
    ).toThrow();
  });
});

describe("gov workflow transitions", () => {
  it("PREPARATION -> INTERNAL_AUDIT only", () => {
    expect(canAdvanceGovWorkflow("PREPARATION", "INTERNAL_AUDIT")).toBe(true);
    expect(canAdvanceGovWorkflow("PREPARATION", "DG_APPROVAL")).toBe(false);
  });
});

describe("gratuity ledger", () => {
  it("outstanding ignores proposed", () => {
    expect(
      outstandingGratuity(100, [
        { status: "PAID", paidAmount: 40 },
        { status: "PROPOSED", proposedAmount: 10 },
      ])
    ).toBe(60);
  });
  it("BR-05", () => {
    expect(canProposeGratuityPayment(50, 51).ok).toBe(false);
  });
});

describe("SoD", () => {
  it("preparer cannot audit own schedule", () => {
    expect(
      violatesSeparationOfDuties({
        preparedById: "a",
        actorId: "a",
        action: "INTERNAL_AUDIT",
      }).ok
    ).toBe(false);
  });
});
