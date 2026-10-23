import { getSession, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { prisma } from "@/lib/database/prisma";
import * as XLSX from "xlsx";

/**
 * Excel .xlsx template for Register Retired / Deceased import.
 * Columns match /api/intake/import. Also supports ?format=csv
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (
    !hasPermission(session, PERMISSIONS.PENSIONERS_CREATE) &&
    !hasPermission(session, PERMISSIONS.PLACEMENTS_MANAGE)
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "xlsx").toLowerCase();

  const headers = [
    "recordStatus",
    "firstName",
    "lastName",
    "middleName",
    "staffNumber",
    "pensionerNumber",
    "organizationCode",
    "retirementDate",
    "dateOfDeath",
    "appointmentDate",
    "yearsOfService",
    "gradeLevel",
    "jobTitle",
    "finalSalary",
    "monthlyPension",
    "bankName",
    "bankAccountNumber",
    "bankAccountName",
    "phone",
    "gender",
    "historyNotes",
  ];

  const sample = [
    "RETIRED",
    "Ada",
    "Okoro",
    "N.",
    "KG-EDU-1990-0100",
    "",
    "KG-MOE",
    "2025-06-30",
    "",
    "1990-03-01",
    "35",
    "GL 14",
    "Chief Education Officer",
    "280000",
    "140000",
    "First Bank of Nigeria",
    "3012345678",
    "Ada N. Okoro",
    "+234-803-000-1000",
    "Female",
    "SAMPLE ROW — delete before import",
  ];

  const orgs = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: { code: true, name: true, type: true },
    orderBy: { code: "asc" },
    take: 200,
  });

  if (format === "csv") {
    const instructions = [
      "# KSCSPMS Register Retired/Deceased Template v1",
      "# recordStatus: RETIRED | DECEASED only",
      "# Dates: YYYY-MM-DD | organizationCode must match Reference sheet",
    ];
    const csv = [
      ...instructions,
      headers.join(","),
      sample.map((c) => (String(c).includes(",") ? `"${c}"` : c)).join(","),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="kscspms-register-template.csv"',
      },
    });
  }

  const wb = XLSX.utils.book_new();

  const dataSheet = [
    headers,
    sample,
    [
      "DECEASED",
      "Hassan",
      "Yusuf",
      "",
      "KG-MOF-1980-0007",
      "",
      "KG-MOF",
      "2020-01-31",
      "2025-08-12",
      "1980-02-01",
      "40",
      "GL 15",
      "Director",
      "290000",
      "145000",
      "Access Bank",
      "0987654321",
      "Hassan Yusuf",
      "",
      "Male",
      "SAMPLE deceased — delete before import",
    ],
  ];
  const wsData = XLSX.utils.aoa_to_sheet(dataSheet);
  XLSX.utils.book_append_sheet(wb, wsData, "DataEntry");

  const instructions = [
    ["KSCSPMS Register Retired / Deceased — Template v1"],
    [""],
    ["Required columns: recordStatus, firstName, lastName, organizationCode"],
    ["RETIRED also requires retirementDate (YYYY-MM-DD)"],
    ["DECEASED: dateOfDeath recommended; ordinary monthly pay will be blocked"],
    ["pensionerNumber optional — auto-generated if blank"],
    ["Do NOT import active serving staff"],
    ["Import never approves pension or triggers payment"],
    ["Use Preview & validate before Confirm import"],
    [""],
    ["Controlled values"],
    ["recordStatus", "RETIRED | DECEASED"],
    ["gender", "Male | Female | Other"],
    ["Dates", "YYYY-MM-DD"],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsInst, "Instructions");

  const refRows = [
    ["organizationCode", "name", "type"],
    ...orgs.map((o) => [o.code, o.name, o.type]),
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  XLSX.utils.book_append_sheet(wb, wsRef, "Reference_MDA");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="kscspms-register-retired-deceased-template.xlsx"',
    },
  });
}
