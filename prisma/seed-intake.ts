/**
 * Seed 30 Register retired / deceased civil servants (intake).
 * Prerequisites: orgs exist (created here if missing). Prefer seed-users-only first.
 *
 *   npx tsx prisma/seed-intake.ts
 *   npm run db:seed:intake
 */
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);

type IntakeRow = {
  recordStatus: "RETIRED" | "DECEASED";
  staffNumber: string;
  pensionerNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  orgCode: string;
  retirementDate?: string;
  dateOfDeath?: string;
  appointmentDate?: string;
  yearsOfService?: number;
  finalSalary?: number;
  gradeLevel?: string;
  jobTitle?: string;
  monthlyPension?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  phone?: string;
  gender?: string;
  historyNotes?: string;
};

const BANKS = [
  "First Bank of Nigeria",
  "Access Bank",
  "UBA",
  "Zenith Bank",
  "GTBank",
  "Union Bank",
  "Fidelity Bank",
];

const JOBS: Record<string, string[]> = {
  "KG-MOE": [
    "Chief Education Officer",
    "Principal",
    "Senior Education Officer",
    "Education Officer I",
    "Head Teacher",
  ],
  "KG-MOH": [
    "Chief Nursing Officer",
    "Principal Medical Officer",
    "Medical Laboratory Scientist",
    "Pharmacist",
    "Health Records Officer",
  ],
  "KG-MOF": [
    "Deputy Director (Accounts)",
    "Chief Accountant",
    "Budget Officer",
    "Auditor",
    "Director (Finance)",
  ],
  "KG-PEN": [
    "Pension Desk Officer",
    "Records Supervisor",
    "Admin Officer",
  ],
};

const FIRST = [
  "Joseph", "Mary", "Samuel", "Aisha", "Peter", "Grace", "Ibrahim", "Ngozi",
  "Tunde", "Fatima", "Chinedu", "Blessing", "Musa", "Ruth", "Hassan",
  "Amina", "Emeka", "Hadiza", "Olumide", "Zainab", "Kayode", "Comfort",
  "Suleiman", "Patience", "Babatunde", "Halima", "Ifeanyi", "Rashida",
  "Gabriel", "Victoria",
];
const LAST = [
  "Adamu", "Okonkwo", "Ibrahim", "Bello", "Ojo", "Adewale", "Sule", "Eze",
  "Balogun", "Yusuf", "Okafor", "Okoro", "Abdullahi", "Nnamani", "Mohammed",
  "Adebayo", "Okeke", "Usman", "Fashola", "Garba", "Aluko", "Danladi",
  "Olatunji", "Chukwu", "Bamidele", "Sanni", "Nwosu", "Lawal", "Oka", "Thomas",
];

function buildRows(): IntakeRow[] {
  const rows: IntakeRow[] = [];
  const orgCycle = ["KG-MOE", "KG-MOH", "KG-MOF", "KG-PEN"];

  for (let i = 0; i < 30; i++) {
    const n = i + 1;
    const isDeceased = i >= 25; // last 5 deceased
    const orgCode = orgCycle[i % orgCycle.length];
    const jobs = JOBS[orgCode] || JOBS["KG-MOF"];
    const gradeNum = 10 + (i % 6);
    const years = 20 + (i % 20);
    const finalSalary = 150000 + i * 8500;
    const monthly = Math.round(finalSalary * 0.5);
    const retireYear = isDeceased ? 2018 + (i % 5) : 2023 + (i % 3);
    const retireMonth = String((i % 12) + 1).padStart(2, "0");
    const apptYear = retireYear - years;

    rows.push({
      recordStatus: isDeceased ? "DECEASED" : "RETIRED",
      staffNumber: `KG-STF-${String(1980 + (i % 20)).slice(2)}-${String(1000 + n).slice(1)}`,
      pensionerNumber: `PEN/KG/${isDeceased ? retireYear : 2025}/${String(n).padStart(4, "0")}`,
      firstName: FIRST[i],
      lastName: LAST[i],
      middleName: i % 3 === 0 ? "O." : undefined,
      orgCode,
      retirementDate: `${retireYear}-${retireMonth}-28`,
      dateOfDeath: isDeceased
        ? `${2024 + (i % 2)}-${String((i % 9) + 1).padStart(2, "0")}-15`
        : undefined,
      appointmentDate: `${apptYear}-03-01`,
      yearsOfService: years + (i % 10) / 10,
      finalSalary,
      gradeLevel: `GL ${gradeNum}`,
      jobTitle: jobs[i % jobs.length],
      monthlyPension: monthly,
      bankName: BANKS[i % BANKS.length],
      bankAccountNumber: String(3000000000 + n * 1117 + i * 99),
      bankAccountName: `${FIRST[i]} ${LAST[i]}`,
      phone: `+234-803-${String(1000000 + n * 37).slice(0, 7)}`,
      gender: i % 2 === 0 ? "Male" : "Female",
      historyNotes: isDeceased
        ? "Deceased seed record — ordinary monthly pension blocked (BR-08)"
        : "Retired seed intake — New Placement pending activation",
    });
  }
  return rows;
}

async function main() {
  console.log("Seeding 30 retired / deceased intake records...\n");
  const ROWS = buildRows();

  const orgDefs = [
    { code: "KG-MOF", name: "Ministry of Finance", type: "MINISTRY" as const },
    { code: "KG-PEN", name: "Kogi State Pension Board", type: "AGENCY" as const },
    { code: "KG-MOE", name: "Ministry of Education", type: "MINISTRY" as const },
    { code: "KG-MOH", name: "Ministry of Health", type: "MINISTRY" as const },
  ];
  const orgByCode: Record<string, string> = {};
  for (const o of orgDefs) {
    const org = await prisma.organization.upsert({
      where: { code: o.code },
      update: {},
      create: { name: o.name, code: o.code, type: o.type, status: "ACTIVE" },
    });
    orgByCode[o.code] = org.id;
  }

  let created = 0;
  let skipped = 0;

  for (const row of ROWS) {
    const organizationId = orgByCode[row.orgCode];
    if (!organizationId) {
      skipped++;
      continue;
    }

    if (await prisma.pensioner.findUnique({ where: { pensionerNumber: row.pensionerNumber } })) {
      console.log(`○ skip ${row.pensionerNumber}`);
      skipped++;
      continue;
    }
    if (await prisma.employee.findUnique({ where: { staffNumber: row.staffNumber } })) {
      console.log(`○ skip staff ${row.staffNumber}`);
      skipped++;
      continue;
    }

    const isDeceased = row.recordStatus === "DECEASED";
    const retirementDate = row.retirementDate ? d(row.retirementDate) : null;

    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          staffNumber: row.staffNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          middleName: row.middleName || null,
          dateOfBirth: d("1960-06-15"),
          gender: row.gender || null,
          phone: row.phone || null,
          organizationId,
          jobTitle: row.jobTitle || null,
          gradeLevel: row.gradeLevel || null,
          employmentStatus: isDeceased ? "DECEASED" : "RETIRED",
          appointmentDate: row.appointmentDate ? d(row.appointmentDate) : null,
        },
      });

      await tx.serviceHistory.create({
        data: {
          employeeId: employee.id,
          organizationId,
          jobTitle: row.jobTitle || null,
          gradeLevel: row.gradeLevel || null,
          startDate: row.appointmentDate
            ? d(row.appointmentDate)
            : retirementDate || new Date(),
          endDate: retirementDate,
          isCurrent: false,
          remarks: [
            row.yearsOfService != null ? `Years of service: ${row.yearsOfService}` : null,
            row.finalSalary != null ? `Final salary basis: ${row.finalSalary}` : null,
            row.historyNotes || null,
          ]
            .filter(Boolean)
            .join("; "),
        },
      });

      if (row.finalSalary != null) {
        await tx.salaryHistory.create({
          data: {
            employeeId: employee.id,
            gradeLevel: row.gradeLevel || "N/A",
            basicSalary: new Decimal(row.finalSalary),
            totalEmolument: new Decimal(row.finalSalary),
            effectiveDate: retirementDate || new Date(),
            remarks: "Final salary at retirement (seed intake)",
          },
        });
      }

      const pensioner = await tx.pensioner.create({
        data: {
          pensionerNumber: row.pensionerNumber,
          employeeId: employee.id,
          organizationId,
          retirementDate,
          enrolmentDate: isDeceased ? null : new Date(),
          monthlyPension:
            row.monthlyPension != null ? new Decimal(row.monthlyPension) : null,
          paymentStatus: isDeceased ? "DECEASED" : "PENDING",
          placementStatus: isDeceased ? "DECEASED" : "NEW_PLACEMENT",
          verificationStatus: "PENDING",
          bankName: row.bankName || null,
          bankAccountNumber: row.bankAccountNumber || null,
          bankAccountName:
            row.bankAccountName || `${row.firstName} ${row.lastName}`,
          dateOfDeath: row.dateOfDeath
            ? d(row.dateOfDeath)
            : isDeceased
              ? new Date()
              : null,
          statusReason: isDeceased ? "Registered as deceased (seed)" : null,
          isActive: !isDeceased,
        },
      });

      if (!isDeceased) {
        await tx.placementRecord.create({
          data: {
            pensionerId: pensioner.id,
            category: "NEW_PLACEMENT",
            status: "PENDING",
            outstandingRequirements:
              "Seed: awaiting verification and payroll activation",
          },
        });
      }
    });

    console.log(
      `✓ ${row.recordStatus.padEnd(8)} ${row.pensionerNumber}  ${row.firstName} ${row.lastName}`
    );
    created++;
  }

  console.log(`\nDone. Created: ${created}, skipped: ${skipped}`);
  console.log("  25 RETIRED → New placements queue");
  console.log("   5 DECEASED → pensioners only (ordinary pay blocked)");
  console.log("Activate placements under Admin → New placements before monthly schedules.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
