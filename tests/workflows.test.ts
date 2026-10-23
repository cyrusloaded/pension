import { describe, it, expect } from "vitest";
import {
  canTransitionPayment,
  getAllowedPaymentTransitions,
} from "../src/lib/workflows/payments";
import {
  getAllowedTransitions,
  stageLabel,
} from "../src/lib/workflows/retirement";

describe("payment workflow", () => {
  it("allows DRAFT to PENDING_REVIEW", () => {
    expect(canTransitionPayment("DRAFT", "PENDING_REVIEW")).toBe(true);
  });

  it("blocks DRAFT to AUTHORIZED", () => {
    expect(canTransitionPayment("DRAFT", "AUTHORIZED")).toBe(false);
  });

  it("has no transitions from RECONCILED", () => {
    expect(getAllowedPaymentTransitions("RECONCILED")).toEqual([]);
  });
});

describe("retirement workflow", () => {
  it("returns allowed stages from eligibility", () => {
    const next = getAllowedTransitions("ELIGIBILITY_ASSESSMENT");
    expect(Array.isArray(next)).toBe(true);
    expect(next.length).toBeGreaterThan(0);
  });

  it("labels stages for display", () => {
    expect(stageLabel("BENEFIT_ASSESSMENT").toLowerCase()).toContain("benefit");
  });
});
