import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";

function splitLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if ((c === "," || c === "\t" || c === ";") && !inQ) {
      result.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

function norm(h: string) {
  return h.toLowerCase().replace(/[\s_]+/g, "");
}

/** Step 4–6: validate + duplicate detect + preview without persisting. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_CREATE) &&
    !hasPermission(session, PERMISSIONS.PLACEMENTS_MANAGE)
  ) {
    return jsonError("Forbidden", 403);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return jsonError("CSV file required", 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return jsonError("File too large (max 5MB)", 400);
  }

  const text = await file.text();
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 2) {
    return jsonError("Header + at least one data row required", 400);
  }

  const headers = splitLine(lines[0]).map(norm);
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(norm(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iStatus = col("recordStatus", "status");
  const iFirst = col("firstName", "first");
  const iLast = col("lastName", "surname");
  const iOrg = col("organizationCode", "orgCode", "mdaCode");
  const iPen = col("pensionerNumber", "pensionNumber");
  const iStaff = col("staffNumber", "serviceNumber");
  const iRet = col("retirementDate");

  if (iFirst < 0 || iLast < 0) {
    return jsonError("Required columns: firstName, lastName", 400);
  }

  const orgs = await prisma.organization.findMany({
    select: { code: true },
  });
  const orgCodes = new Set(orgs.map((o) => o.code.toUpperCase()));

  const preview: {
    rowNumber: number;
    status: "VALID" | "INVALID" | "DUPLICATE";
    action: "CREATE" | "SKIP";
    firstName: string;
    lastName: string;
    recordStatus: string;
    pensionerNumber: string;
    error?: string;
  }[] = [];

  let valid = 0;
  let invalid = 0;
  let duplicate = 0;

  for (let li = 1; li < lines.length; li++) {
    const cols = splitLine(lines[li]);
    const g = (i: number) => (i >= 0 ? cols[i] || "" : "").trim();
    const rowNumber = li + 1;
    const recordStatus = (g(iStatus) || "RETIRED").toUpperCase();
    const firstName = g(iFirst);
    const lastName = g(iLast);
    const orgCode = g(iOrg).toUpperCase();
    const pensionerNumber = g(iPen);
    const staffNumber = g(iStaff);
    const retirementDate = g(iRet);

    if (!["RETIRED", "DECEASED"].includes(recordStatus)) {
      invalid++;
      preview.push({
        rowNumber,
        status: "INVALID",
        action: "SKIP",
        firstName,
        lastName,
        recordStatus,
        pensionerNumber,
        error: "recordStatus must be RETIRED or DECEASED",
      });
      continue;
    }
    if (!firstName || !lastName) {
      invalid++;
      preview.push({
        rowNumber,
        status: "INVALID",
        action: "SKIP",
        firstName,
        lastName,
        recordStatus,
        pensionerNumber,
        error: "Name required",
      });
      continue;
    }
    if (!orgCode || !orgCodes.has(orgCode)) {
      invalid++;
      preview.push({
        rowNumber,
        status: "INVALID",
        action: "SKIP",
        firstName,
        lastName,
        recordStatus,
        pensionerNumber,
        error: `Unknown organizationCode: ${orgCode || "(blank)"}`,
      });
      continue;
    }
    if (recordStatus === "RETIRED" && !retirementDate) {
      invalid++;
      preview.push({
        rowNumber,
        status: "INVALID",
        action: "SKIP",
        firstName,
        lastName,
        recordStatus,
        pensionerNumber,
        error: "retirementDate required for RETIRED",
      });
      continue;
    }

    let isDup = false;
    if (pensionerNumber) {
      const hit = await prisma.pensioner.findUnique({
        where: { pensionerNumber },
      });
      if (hit) isDup = true;
    }
    if (!isDup && staffNumber) {
      const hit = await prisma.employee.findUnique({
        where: { staffNumber },
      });
      if (hit) isDup = true;
    }

    if (isDup) {
      duplicate++;
      preview.push({
        rowNumber,
        status: "DUPLICATE",
        action: "SKIP",
        firstName,
        lastName,
        recordStatus,
        pensionerNumber,
        error: "Matching pension or service number already exists",
      });
      continue;
    }

    valid++;
    preview.push({
      rowNumber,
      status: "VALID",
      action: "CREATE",
      firstName,
      lastName,
      recordStatus,
      pensionerNumber: pensionerNumber || "(auto)",
    });
  }

  return jsonOk({
    filename: file.name,
    totalRows: lines.length - 1,
    validRows: valid,
    invalidRows: invalid,
    duplicateRows: duplicate,
    wouldCreate: valid,
    preview: preview.slice(0, 200),
    templateVersion: "v1",
    message: "Preview only — no records written. Confirm import to persist.",
  });
}
