/**
 * Versioned pension benefit calculation engine.
 *
 * Official formulas must be supplied via approved PensionRuleVersion.rulesJson.
 * When calculationMethod is PLACEHOLDER or required factors are null,
 * the engine returns a non-production result and does not invent legal amounts.
 */

export interface RuleParams {
  note?: string;
  eligibilityMinYears?: number | null;
  qualifyingServiceMethod?: string;
  calculationMethod?: string;
  /** Fraction of final salary for monthly pension, e.g. 0.5 = 50% — only if policy-approved */
  monthlyPensionFactor?: number | null;
  /** Multiplier of final salary for gratuity, e.g. years * factor — only if policy-approved */
  gratuityFactor?: number | null;
  gratuityPerYearOfService?: number | null;
  maxMonthlyPension?: number | null;
  minQualifyingYearsForFull?: number | null;
  rounding?: "NEAREST_NAIRA" | "FLOOR" | "CEIL" | "NONE";
  [key: string]: unknown;
}

export interface CalculationInput {
  qualifyingServiceYears: number;
  finalSalary: number;
  appointmentDate?: Date | null;
  retirementDate?: Date | null;
  dateOfBirth?: Date | null;
}

export interface CalculationBreakdownLine {
  label: string;
  value: number | string | null;
  note?: string;
}

export interface CalculationResult {
  productionReady: boolean;
  warnings: string[];
  grossEntitlement: number | null;
  deductions: number;
  netEntitlement: number | null;
  gratuityAmount: number | null;
  monthlyPension: number | null;
  breakdown: CalculationBreakdownLine[];
  inputsSnapshot: CalculationInput & { ruleVersionId?: string; ruleVersion?: string };
}

function roundAmount(value: number, mode?: string): number {
  switch (mode) {
    case "FLOOR":
      return Math.floor(value);
    case "CEIL":
      return Math.ceil(value);
    case "NONE":
      return value;
    case "NEAREST_NAIRA":
    default:
      return Math.round(value);
  }
}

function yearsBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Derive qualifying service years from dates when not supplied explicitly.
 */
export function deriveServiceYears(
  appointmentDate: Date | null | undefined,
  retirementDate: Date | null | undefined
): number | null {
  if (!appointmentDate || !retirementDate) return null;
  return Math.round(yearsBetween(appointmentDate, retirementDate) * 100) / 100;
}

export function calculateBenefit(
  rules: RuleParams,
  input: CalculationInput,
  meta?: { ruleVersionId?: string; ruleVersion?: string }
): CalculationResult {
  const warnings: string[] = [];
  const breakdown: CalculationBreakdownLine[] = [];
  const method = (rules.calculationMethod || "PLACEHOLDER").toUpperCase();

  breakdown.push({
    label: "Qualifying service (years)",
    value: input.qualifyingServiceYears,
  });
  breakdown.push({
    label: "Final salary (₦)",
    value: input.finalSalary,
  });
  breakdown.push({
    label: "Calculation method",
    value: method,
  });

  if (rules.note) {
    warnings.push(String(rules.note));
  }

  // Eligibility check
  const minYears = rules.eligibilityMinYears;
  if (minYears != null && input.qualifyingServiceYears < minYears) {
    warnings.push(
      `Qualifying service (${input.qualifyingServiceYears} years) is below configured minimum (${minYears} years).`
    );
  }

  // Non-production placeholder
  if (
    method === "PLACEHOLDER" ||
    method === "UNCONFIGURED" ||
    (rules.monthlyPensionFactor == null && rules.gratuityFactor == null && rules.gratuityPerYearOfService == null)
  ) {
    warnings.push(
      "OFFICIAL RULES NOT CONFIGURED — This assessment is not production-ready. Configure approved rule parameters before awarding benefits."
    );
    return {
      productionReady: false,
      warnings,
      grossEntitlement: null,
      deductions: 0,
      netEntitlement: null,
      gratuityAmount: null,
      monthlyPension: null,
      breakdown,
      inputsSnapshot: { ...input, ...meta },
    };
  }

  let monthlyPension: number | null = null;
  let gratuityAmount: number | null = null;

  // Configurable factor method (only when factors are explicitly set by administrators)
  if (rules.monthlyPensionFactor != null && rules.monthlyPensionFactor > 0) {
    let factor = rules.monthlyPensionFactor;
    if (
      rules.minQualifyingYearsForFull != null &&
      input.qualifyingServiceYears < rules.minQualifyingYearsForFull
    ) {
      const proRata = input.qualifyingServiceYears / rules.minQualifyingYearsForFull;
      factor = factor * Math.min(1, proRata);
      breakdown.push({
        label: "Pro-rata factor applied",
        value: Math.round(proRata * 10000) / 10000,
        note: `Service below full-qualifying years (${rules.minQualifyingYearsForFull})`,
      });
    }
    monthlyPension = roundAmount(
      input.finalSalary * factor,
      rules.rounding
    );
    if (rules.maxMonthlyPension != null && monthlyPension > rules.maxMonthlyPension) {
      monthlyPension = rules.maxMonthlyPension;
      warnings.push(`Monthly pension capped at configured maximum ₦${rules.maxMonthlyPension}.`);
    }
    breakdown.push({
      label: "Monthly pension factor",
      value: rules.monthlyPensionFactor,
    });
    breakdown.push({
      label: "Monthly pension (₦)",
      value: monthlyPension,
    });
  }

  if (rules.gratuityPerYearOfService != null && rules.gratuityPerYearOfService > 0) {
    gratuityAmount = roundAmount(
      input.finalSalary *
        rules.gratuityPerYearOfService *
        input.qualifyingServiceYears,
      rules.rounding
    );
    breakdown.push({
      label: "Gratuity per year of service factor",
      value: rules.gratuityPerYearOfService,
    });
    breakdown.push({
      label: "Gratuity (₦)",
      value: gratuityAmount,
    });
  } else if (rules.gratuityFactor != null && rules.gratuityFactor > 0) {
    gratuityAmount = roundAmount(
      input.finalSalary * rules.gratuityFactor,
      rules.rounding
    );
    breakdown.push({
      label: "Gratuity factor",
      value: rules.gratuityFactor,
    });
    breakdown.push({
      label: "Gratuity (₦)",
      value: gratuityAmount,
    });
  }

  const gross =
    (monthlyPension ?? 0) * 12 + (gratuityAmount ?? 0); // illustrative annualised gross for storage
  const deductions = 0;
  const net = gross - deductions;

  const productionReady =
    monthlyPension != null || gratuityAmount != null;

  if (!productionReady) {
    warnings.push("No payable amounts could be derived from configured factors.");
  }

  return {
    productionReady,
    warnings,
    grossEntitlement: productionReady ? roundAmount(gross, rules.rounding) : null,
    deductions,
    netEntitlement: productionReady ? roundAmount(net, rules.rounding) : null,
    gratuityAmount,
    monthlyPension,
    breakdown,
    inputsSnapshot: { ...input, ...meta },
  };
}
