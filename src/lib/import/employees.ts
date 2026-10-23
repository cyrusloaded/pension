import { prisma } from "@/lib/database/prisma";

export interface EmployeeImportRow {
  staffNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  organizationCode: string;
  jobTitle?: string | null;
  gradeLevel?: string | null;
  employmentStatus?: string | null;
  nin?: string | null;
  appointmentDate?: string | null;
}

export interface ImportRowResult {
  row: number;
  staffNumber: string;
  status: "CREATED" | "SKIPPED_DUPLICATE" | "ERROR";
  message?: string;
  id?: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  skippedDuplicates: number;
  errors: number;
  results: ImportRowResult[];
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value || !String(value).trim()) return null;
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Import employees from validated rows.
 * Duplicate detection: staffNumber (unique) and NIN when provided.
 */
export async function importEmployees(
  rows: EmployeeImportRow[],
  actorId: string
): Promise<ImportSummary> {
  const results: ImportRowResult[] = [];
  let created = 0;
  let skippedDuplicates = 0;
  let errors = 0;

  // Preload orgs by code
  const codes = [...new Set(rows.map((r) => r.organizationCode.trim().toUpperCase()))];
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { code: { in: codes } },
        { code: { in: codes.map((c) => c.toLowerCase()) } },
      ],
    },
  });
  const orgByCode = new Map(
    orgs.map((o) => [o.code.toUpperCase(), o])
  );

  // Existing staff numbers / NINs for batch
  const staffNumbers = rows.map((r) => r.staffNumber.trim());
  const nins = rows
    .map((r) => r.nin?.trim())
    .filter((n): n is string => !!n && n.length > 0);

  const existing = await prisma.employee.findMany({
    where: {
      OR: [
        { staffNumber: { in: staffNumbers } },
        ...(nins.length ? [{ nin: { in: nins } }] : []),
      ],
    },
    select: { staffNumber: true, nin: true },
  });
  const existingStaff = new Set(existing.map((e) => e.staffNumber));
  const existingNin = new Set(
    existing.map((e) => e.nin).filter((n): n is string => !!n)
  );

  // Within-file duplicates
  const seenStaff = new Set<string>();
  const seenNin = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];
    const staffNumber = r.staffNumber?.trim();
    if (!staffNumber || !r.firstName?.trim() || !r.lastName?.trim()) {
      errors++;
      results.push({
        row: rowNum,
        staffNumber: staffNumber || "",
        status: "ERROR",
        message: "staffNumber, firstName, and lastName are required",
      });
      continue;
    }

    if (seenStaff.has(staffNumber) || existingStaff.has(staffNumber)) {
      skippedDuplicates++;
      results.push({
        row: rowNum,
        staffNumber,
        status: "SKIPPED_DUPLICATE",
        message: "Duplicate staff number",
      });
      continue;
    }

    const nin = r.nin?.trim() || null;
    if (nin && (seenNin.has(nin) || existingNin.has(nin))) {
      skippedDuplicates++;
      results.push({
        row: rowNum,
        staffNumber,
        status: "SKIPPED_DUPLICATE",
        message: "Duplicate NIN",
      });
      continue;
    }

    const org = orgByCode.get(r.organizationCode.trim().toUpperCase());
    if (!org) {
      errors++;
      results.push({
        row: rowNum,
        staffNumber,
        status: "ERROR",
        message: `Unknown organization code: ${r.organizationCode}`,
      });
      continue;
    }

    const dob = parseDate(r.dateOfBirth);
    if (!dob) {
      errors++;
      results.push({
        row: rowNum,
        staffNumber,
        status: "ERROR",
        message: "Valid dateOfBirth (ISO date) is required",
      });
      continue;
    }

    try {
      const emp = await prisma.employee.create({
        data: {
          staffNumber,
          firstName: r.firstName.trim(),
          lastName: r.lastName.trim(),
          middleName: r.middleName?.trim() || null,
          dateOfBirth: dob,
          gender: r.gender?.trim() || null,
          phone: r.phone?.trim() || null,
          email: r.email?.trim() || null,
          organizationId: org.id,
          jobTitle: r.jobTitle?.trim() || null,
          gradeLevel: r.gradeLevel?.trim() || null,
          employmentStatus: r.employmentStatus?.trim() || "ACTIVE",
          nin,
          appointmentDate: parseDate(r.appointmentDate),
          createdById: actorId,
        },
      });
      seenStaff.add(staffNumber);
      if (nin) seenNin.add(nin);
      existingStaff.add(staffNumber);
      if (nin) existingNin.add(nin);
      created++;
      results.push({
        row: rowNum,
        staffNumber,
        status: "CREATED",
        id: emp.id,
      });
    } catch (e) {
      errors++;
      results.push({
        row: rowNum,
        staffNumber,
        status: "ERROR",
        message: e instanceof Error ? e.message : "Create failed",
      });
    }
  }

  return {
    total: rows.length,
    created,
    skippedDuplicates,
    errors,
    results,
  };
}
