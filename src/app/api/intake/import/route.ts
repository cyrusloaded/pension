import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { jsonError, jsonOk } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/logger";
import { Decimal } from "@prisma/client/runtime/library";

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

/**
 * Upload CSV → validate → create ImportBatch + persist valid RETIRED/DECEASED rows.
 * Does NOT approve pension or trigger payment.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_CREATE) &&
    !hasPermission(session, PERMISSIONS.PLACEMENTS_MANAGE)
  ) {
    return jsonError("Forbidden", 403);
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") || "CREATE_ONLY").toUpperCase();
    if (!file || !(file instanceof File)) {
      return jsonError("CSV file is required", 400);
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      return jsonError("Upload a .csv file (export Excel as CSV)", 400);
    }

    const text = await file.text();
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    if (lines.length < 2) {
      return jsonError("File needs a header row and at least one data row", 400);
    }

    const headers = splitLine(lines[0]).map(norm);
    const idx = (key: string) => {
      const aliases: Record<string, string[]> = {
        recordstatus: ["recordstatus", "status", "type"],
        firstname: ["firstname", "first"],
        lastname: ["lastname", "surname", "last"],
        middlename: ["middlename", "othernames"],
        staffnumber: ["staffnumber", "servicenumber", "staffno"],
        pensionernumber: ["pensionernumber", "pensionnumber", "penno"],
        organizationcode: [
          "organizationcode",
          "orgcode",
          "mdacode",
          "ministrycode",
        ],
        retirementdate: ["retirementdate", "dateofretirement"],
        dateofdeath: ["dateofdeath", "deathdate"],
        appointmentdate: ["appointmentdate", "dateoffirstappointment"],
        yearsofservice: ["yearsofservice", "serviceyears"],
        gradelevel: ["gradelevel", "grade"],
        jobtitle: ["jobtitle", "designation"],
        finalsalary: ["finalsalary", "lastsalary"],
        monthlypension: ["monthlypension", "pensionamount"],
        bankname: ["bankname", "bank"],
        bankaccountnumber: ["bankaccountnumber", "accountnumber", "accountno"],
        bankaccountname: ["bankaccountname", "accountname"],
        phone: ["phone", "mobile"],
        gender: ["gender", "sex"],
        historynotes: ["historynotes", "notes", "remarks"],
      };
      for (const a of aliases[key] || [key]) {
        const i = headers.indexOf(a);
        if (i >= 0) return i;
      }
      return -1;
    };

    const iStatus = idx("recordstatus");
    const iFirst = idx("firstname");
    const iLast = idx("lastname");
    const iOrg = idx("organizationcode");
    if (iFirst < 0 || iLast < 0) {
      return jsonError("Required columns: firstName, lastName", 400);
    }

    const orgs = await prisma.organization.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, code: true },
    });
    const orgByCode = new Map(orgs.map((o) => [o.code.toUpperCase(), o.id]));

    const batchRef = `IMP-INTAKE-${Date.now().toString(36).toUpperCase()}`;
    const batch = await prisma.importBatch.create({
      data: {
        batchRef,
        module: "INTAKE",
        originalFilename: file.name,
        templateVersion: "v1",
        status: "PROCESSING",
        totalRows: lines.length - 1,
        uploadedById: session.id,
      },
    });

    let validRows = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const rowResults: {
      rowNumber: number;
      status: string;
      errorMessage?: string;
      pensionerNumber?: string;
      createdRecordId?: string;
      rawData?: object;
    }[] = [];

    for (let li = 1; li < lines.length; li++) {
      const cols = splitLine(lines[li]);
      const get = (i: number) => (i >= 0 ? (cols[i] || "").trim() : "");
      const rowNumber = li + 1;
      const recordStatus = (get(iStatus) || "RETIRED").toUpperCase();
      const firstName = get(iFirst);
      const lastName = get(iLast);
      const orgCode = get(iOrg).toUpperCase();
      const staffNumber =
        get(idx("staffnumber")) ||
        `IMP/${batchRef}/${rowNumber}`;
      let pensionerNumber = get(idx("pensionernumber"));
      const raw = {
        recordStatus,
        firstName,
        lastName,
        orgCode,
        staffNumber,
        pensionerNumber,
      };

      if (!["RETIRED", "DECEASED"].includes(recordStatus)) {
        failedCount++;
        rowResults.push({
          rowNumber,
          status: "INVALID",
          errorMessage: "recordStatus must be RETIRED or DECEASED",
          rawData: raw,
        });
        continue;
      }
      if (!firstName || !lastName) {
        failedCount++;
        rowResults.push({
          rowNumber,
          status: "INVALID",
          errorMessage: "firstName and lastName required",
          rawData: raw,
        });
        continue;
      }
      const organizationId = orgCode ? orgByCode.get(orgCode) : undefined;
      if (!organizationId) {
        failedCount++;
        rowResults.push({
          rowNumber,
          status: "INVALID",
          errorMessage: `Unknown organizationCode: ${orgCode || "(blank)"}`,
          rawData: raw,
        });
        continue;
      }

      if (
        pensionerNumber &&
        (await prisma.pensioner.findUnique({ where: { pensionerNumber } }))
      ) {
        skippedCount++;
        rowResults.push({
          rowNumber,
          status: "DUPLICATE",
          errorMessage: "Pension number already exists",
          pensionerNumber,
          rawData: raw,
        });
        continue;
      }
      if (await prisma.employee.findUnique({ where: { staffNumber } })) {
        skippedCount++;
        rowResults.push({
          rowNumber,
          status: "DUPLICATE",
          errorMessage: "Staff/service number already exists",
          rawData: raw,
        });
        continue;
      }

      validRows++;
      const isDeceased = recordStatus === "DECEASED";
      const retirementDateStr = get(idx("retirementdate"));
      const retirementDate = retirementDateStr
        ? new Date(retirementDateStr)
        : null;
      if (recordStatus === "RETIRED" && !retirementDateStr) {
        failedCount++;
        validRows--;
        rowResults.push({
          rowNumber,
          status: "INVALID",
          errorMessage: "retirementDate required for RETIRED",
          rawData: raw,
        });
        continue;
      }

      try {
        if (!pensionerNumber) {
          const y = new Date().getFullYear();
          const n = await prisma.pensioner.count();
          pensionerNumber = `PEN/KG/${y}/${String(n + 1 + createdCount).padStart(4, "0")}`;
        }

        const finalSalary = Number(get(idx("finalsalary")) || "") || null;
        const monthlyPension = Number(get(idx("monthlypension")) || "") || null;
        const yearsOfService = Number(get(idx("yearsofservice")) || "") || null;

        const created = await prisma.$transaction(async (tx) => {
          const history = await tx.employee.create({
            data: {
              staffNumber,
              firstName,
              lastName,
              middleName: get(idx("middlename")) || null,
              dateOfBirth: new Date("1960-01-01"),
              gender: get(idx("gender")) || null,
              phone: get(idx("phone")) || null,
              organizationId,
              jobTitle: get(idx("jobtitle")) || null,
              gradeLevel: get(idx("gradelevel")) || null,
              employmentStatus: isDeceased ? "DECEASED" : "RETIRED",
              appointmentDate: get(idx("appointmentdate"))
                ? new Date(get(idx("appointmentdate")))
                : null,
            },
          });

          if (yearsOfService != null || finalSalary != null) {
            await tx.serviceHistory.create({
              data: {
                employeeId: history.id,
                organizationId,
                jobTitle: get(idx("jobtitle")) || null,
                gradeLevel: get(idx("gradelevel")) || null,
                startDate: get(idx("appointmentdate"))
                  ? new Date(get(idx("appointmentdate")))
                  : retirementDate || new Date(),
                endDate: retirementDate,
                remarks: [
                  yearsOfService != null
                    ? `Years of service: ${yearsOfService}`
                    : null,
                  get(idx("historynotes")) || null,
                ]
                  .filter(Boolean)
                  .join("; "),
              },
            });
          }

          if (finalSalary != null) {
            await tx.salaryHistory.create({
              data: {
                employeeId: history.id,
                gradeLevel: get(idx("gradelevel")) || "N/A",
                basicSalary: new Decimal(finalSalary),
                totalEmolument: new Decimal(finalSalary),
                effectiveDate: retirementDate || new Date(),
                remarks: "Import intake",
              },
            });
          }

          const pensioner = await tx.pensioner.create({
            data: {
              pensionerNumber,
              employeeId: history.id,
              organizationId,
              retirementDate,
              enrolmentDate: isDeceased ? null : new Date(),
              monthlyPension:
                monthlyPension != null ? new Decimal(monthlyPension) : null,
              paymentStatus: isDeceased ? "DECEASED" : "PENDING",
              placementStatus: isDeceased ? "DECEASED" : "NEW_PLACEMENT",
              verificationStatus: "PENDING",
              bankName: get(idx("bankname")) || null,
              bankAccountNumber: get(idx("bankaccountnumber")) || null,
              bankAccountName:
                get(idx("bankaccountname")) || `${firstName} ${lastName}`,
              dateOfDeath: get(idx("dateofdeath"))
                ? new Date(get(idx("dateofdeath")))
                : isDeceased
                  ? new Date()
                  : null,
              isActive: !isDeceased,
            },
          });

          if (!isDeceased) {
            await tx.placementRecord.create({
              data: {
                pensionerId: pensioner.id,
                category: "NEW_PLACEMENT",
                status: "PENDING",
                outstandingRequirements: "Imported — awaiting activation",
                createdById: session.id,
              },
            });
          }
          return pensioner;
        });

        createdCount++;
        rowResults.push({
          rowNumber,
          status: "CREATED",
          pensionerNumber: created.pensionerNumber,
          createdRecordId: created.id,
          rawData: raw,
        });
      } catch (err) {
        failedCount++;
        rowResults.push({
          rowNumber,
          status: "FAILED",
          errorMessage:
            err instanceof Error ? err.message : "Row persistence failed",
          rawData: raw,
        });
      }
    }

    await prisma.importBatchRow.createMany({
      data: rowResults.map((r) => ({
        batchId: batch.id,
        rowNumber: r.rowNumber,
        status: r.status,
        errorMessage: r.errorMessage || null,
        pensionerNumber: r.pensionerNumber || null,
        createdRecordId: r.createdRecordId || null,
        rawData: r.rawData || undefined,
      })),
    });

    const updated = await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETED",
        validRows,
        invalidRows: failedCount,
        createdCount,
        skippedCount,
        failedCount,
        completedAt: new Date(),
        errorSummary:
          failedCount > 0
            ? `${failedCount} row(s) failed validation or persistence`
            : null,
      },
    });

    await writeAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      action: "INTAKE.IMPORT",
      entityType: "ImportBatch",
      entityId: batch.id,
      afterValues: {
        batchRef,
        createdCount,
        skippedCount,
        failedCount,
        mode,
      },
    });

    return jsonOk({
      batch: updated,
      createdCount,
      skippedCount,
      failedCount,
      validRows,
      rows: rowResults.slice(0, 100),
      message: `Import completed: ${createdCount} created, ${skippedCount} skipped, ${failedCount} failed`,
    });
  } catch (e) {
    console.error("Intake import error:", e);
    return jsonError(
      e instanceof Error ? e.message : "Import failed",
      500
    );
  }
}
