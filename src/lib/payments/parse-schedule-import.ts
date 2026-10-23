/**
 * Parse CSV or simple TSV schedule import.
 * Expected columns (header row, case-insensitive):
 *   pensionerNumber | amount | bankName | bankAccountNumber | adjustments | deductions
 */

export type ImportRow = {
  rowNumber: number;
  pensionerNumber: string;
  amount: number;
  bankName?: string;
  bankAccountNumber?: string;
  adjustments?: number;
  deductions?: number;
  error?: string;
};

function splitLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((c === "," || c === "\t" || c === ";") && !inQuotes) {
      result.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_]+/g, "");
}

const HEADER_MAP: Record<string, keyof Omit<ImportRow, "rowNumber" | "error">> = {
  pensionernumber: "pensionerNumber",
  pensionerno: "pensionerNumber",
  penno: "pensionerNumber",
  amount: "amount",
  netamount: "amount",
  monthlypension: "amount",
  bankname: "bankName",
  bank: "bankName",
  bankaccountnumber: "bankAccountNumber",
  accountnumber: "bankAccountNumber",
  accountno: "bankAccountNumber",
  adjustments: "adjustments",
  deductions: "deductions",
};

export function parseScheduleCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error("File must include a header row and at least one data row");
  }

  const headers = splitLine(lines[0]).map(normHeader);
  const indexes: Partial<Record<keyof ImportRow, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h];
    if (key) indexes[key] = i;
  });
  if (indexes.pensionerNumber === undefined || indexes.amount === undefined) {
    throw new Error(
      "Required columns: pensionerNumber, amount (optional: bankName, bankAccountNumber, adjustments, deductions)"
    );
  }

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const pensionerNumber = (cols[indexes.pensionerNumber!] ?? "").trim();
    const amountRaw = (cols[indexes.amount!] ?? "").replace(/,/g, "").trim();
    const amount = Number(amountRaw);
    const row: ImportRow = {
      rowNumber: i + 1,
      pensionerNumber,
      amount: Number.isFinite(amount) ? amount : NaN,
    };
    if (indexes.bankName !== undefined) {
      row.bankName = (cols[indexes.bankName] ?? "").trim() || undefined;
    }
    if (indexes.bankAccountNumber !== undefined) {
      row.bankAccountNumber =
        (cols[indexes.bankAccountNumber] ?? "").trim() || undefined;
    }
    if (indexes.adjustments !== undefined) {
      const v = Number((cols[indexes.adjustments] ?? "0").replace(/,/g, ""));
      if (Number.isFinite(v)) row.adjustments = v;
    }
    if (indexes.deductions !== undefined) {
      const v = Number((cols[indexes.deductions] ?? "0").replace(/,/g, ""));
      if (Number.isFinite(v)) row.deductions = v;
    }
    if (!pensionerNumber) row.error = "Missing pensionerNumber";
    else if (!Number.isFinite(row.amount) || row.amount <= 0)
      row.error = "Invalid amount";
    rows.push(row);
  }
  return rows;
}

export function buildScheduleRef(period: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `PAY-${period.replace(/[^0-9]/g, "") || "IMPORT"}-${stamp}`;
}

export function buildAssessmentCode(period: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `ASM-${period.replace(/[^0-9]/g, "") || "PAY"}-${stamp}`;
}
