import { describe, it, expect } from "vitest";
import {
  outstandingGratuity,
  canProposeGratuityPayment,
  isEligibleForMonthlyPension,
  violatesSeparationOfDuties,
  canAdvanceGovWorkflow,
} from "../business-rules";

describe("gratuity outstanding (BR-04/07/12)", () => {
  it("ignores non-PAID installments", () => {
    const o = outstandingGratuity(7_000_000, [
      { status: "PAID", paidAmount: 2_000_000 },
      { status: "PROPOSED", proposedAmount: 500_000 },
      { status: "FAILED", proposedAmount: 100_000 },
    ]);
    expect(o).toBe(5_000_000);
  });
});

describe("BR-05 propose limit", () => {
  it("blocks over outstanding", () => {
    const r = canProposeGratuityPayment(1000, 1001);
    expect(r.ok).toBe(false);
  });
  it("allows within outstanding", () => {
    expect(canProposeGratuityPayment(1000, 1000).ok).toBe(true);
  });
});

describe("BR-08 eligibility", () => {
  it("blocks new placement and deceased", () => {
    expect(
      isEligibleForMonthlyPension({
        isActive: true,
        paymentStatus: "PENDING",
        placementStatus: "NEW_PLACEMENT",
      })
    ).toBe(false);
    expect(
      isEligibleForMonthlyPension({
        isActive: false,
        paymentStatus: "DECEASED",
        placementStatus: "DECEASED",
      })
    ).toBe(false);
  });
  it("allows active", () => {
    expect(
      isEligibleForMonthlyPension({
        isActive: true,
        paymentStatus: "ACTIVE",
        placementStatus: "ACTIVE",
      })
    ).toBe(true);
  });
});

describe("SoD and workflow", () => {
  it("blocks preparer as auditor", () => {
    const r = violatesSeparationOfDuties({
      preparedById: "u1",
      actorId: "u1",
      action: "INTERNAL_AUDIT",
    });
    expect(r.ok).toBe(false);
  });
  it("allows gov stage advance", () => {
    expect(canAdvanceGovWorkflow("PREPARATION", "INTERNAL_AUDIT")).toBe(true);
    expect(canAdvanceGovWorkflow("PREPARATION", "DFA_PAYMENT")).toBe(false);
  });
});
