import { describe, it, expect } from "vitest";
import {
  calculateBenefit,
  deriveServiceYears,
} from "../src/lib/calculations/benefit-engine";

describe("benefit engine", () => {
  it("returns non-production result for PLACEHOLDER rules", () => {
    const result = calculateBenefit(
      { calculationMethod: "PLACEHOLDER", note: "test" },
      { qualifyingServiceYears: 30, finalSalary: 200000 }
    );
    expect(result.productionReady).toBe(false);
    expect(result.monthlyPension).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("computes factor-based pension and gratuity when configured", () => {
    const result = calculateBenefit(
      {
        calculationMethod: "FACTOR",
        monthlyPensionFactor: 0.5,
        gratuityPerYearOfService: 1,
        rounding: "NEAREST_NAIRA",
      },
      { qualifyingServiceYears: 20, finalSalary: 100000 }
    );
    expect(result.productionReady).toBe(true);
    expect(result.monthlyPension).toBe(50000);
    expect(result.gratuityAmount).toBe(2_000_000);
  });

  it("derives service years from dates", () => {
    const years = deriveServiceYears(
      new Date("2000-01-01"),
      new Date("2010-01-01")
    );
    expect(years).not.toBeNull();
    expect(years!).toBeGreaterThan(9.9);
    expect(years!).toBeLessThan(10.2);
  });
});
