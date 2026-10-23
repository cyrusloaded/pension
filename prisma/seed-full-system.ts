/**
 * Full system seed — synthetic demo data for every major module/page.
 * Safe to re-run: skips existing unique keys.
 *
 *   npx tsx prisma/seed-users-only.ts   # permissions + logins first
 *   npx tsx prisma/seed-full-system.ts
 *
 * Password for all users: ChangeMe@2026!
 */
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_CODES } from "../src/lib/permissions/constants";

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);
const dec = (n: number) => new Decimal(n);

async function main() {
  console.log("=== KSCSPMS full system seed ===\n");

  // —— 1. Permissions & roles (minimal, same as users seed) ——
  for (const code of Object.values(PERMISSIONS)) {
    const [module] = code.split(".");
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        module: module ?? "general",
        description: `Permission: ${code}`,
      },
    });
  }

  const rolesData = [
    { code: ROLE_CODES.SUPER_ADMIN, name: "Super Administrator", isSystem: true },
    { code: ROLE_CODES.PENSION_RECORDS, name: "Pension Records Officer", isSystem: true },
    { code: ROLE_CODES.SCHEDULE_PREP, name: "Schedule Preparation Officer", isSystem: true },
    { code: ROLE_CODES.INTERNAL_AUDITOR, name: "Internal Auditor", isSystem: true },
    { code: ROLE_CODES.DIRECTOR_GENERAL, name: "Director-General", isSystem: true },
    { code: ROLE_CODES.DFA, name: "Director of Finance and Accounts", isSystem: true },
    { code: ROLE_CODES.VERIFICATION_OFFICER, name: "Verification Officer", isSystem: true },
    { code: ROLE_CODES.CUSTOMER_SUPPORT, name: "Customer Support", isSystem: true },
    { code: ROLE_CODES.FINANCE_OFFICER, name: "Finance Officer", isSystem: true },
    { code: ROLE_CODES.BENEFIT_CALC, name: "Benefit Calculation Officer", isSystem: true },
    { code: ROLE_CODES.APPROVAL_OFFICER, name: "Approval Officer", isSystem: true },
    { code: ROLE_CODES.RECONCILIATION_OFFICER, name: "Reconciliation Officer", isSystem: true },
  ];
  for (const r of rolesData) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: r,
    });
  }

  const allPerms = await prisma.permission.findMany();
  const superRole = await prisma.role.findUniqueOrThrow({
    where: { code: ROLE_CODES.SUPER_ADMIN },
  });
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: superRole.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: superRole.id, permissionId: perm.id },
    });
  }

  async function grant(roleCode: string, codes: string[]) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) return;
    for (const code of codes) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  await grant(ROLE_CODES.PENSION_RECORDS, [
    "pensioners.read", "pensioners.create", "pensioners.update",
    "placements.read", "placements.manage", "employees.read",
    "payments.prepare", "payments.read", "gratuity.read", "reports.view",
  ]);
  await grant(ROLE_CODES.SCHEDULE_PREP, [
    "payments.prepare", "payments.read", "pensioners.read", "gratuity.read", "gratuity.manage",
  ]);
  await grant(ROLE_CODES.INTERNAL_AUDITOR, [
    "schedule.audit", "payments.read", "pensioners.read", "audit.read", "reports.view",
  ]);
  await grant(ROLE_CODES.DIRECTOR_GENERAL, [
    "schedule.dg_approve", "payments.authorize", "payments.read", "pensioners.read", "benefits.approve",
  ]);
  await grant(ROLE_CODES.DFA, [
    "schedule.dfa_pay", "payments.authorize", "payments.read", "payments.reconcile", "gratuity.manage",
  ]);
  await grant(ROLE_CODES.VERIFICATION_OFFICER, [
    "verification.read", "verification.manage", "pensioners.read",
  ]);
  await grant(ROLE_CODES.CUSTOMER_SUPPORT, [
    "complaints.read", "complaints.manage", "pensioners.read",
  ]);
  await grant(ROLE_CODES.FINANCE_OFFICER, [
    "payments.prepare", "payments.read", "pensioners.read", "reports.view",
  ]);
  await grant(ROLE_CODES.BENEFIT_CALC, [
    "benefits.calculate", "retirements.read", "employees.read",
  ]);
  await grant(ROLE_CODES.APPROVAL_OFFICER, [
    "benefits.approve", "retirements.review", "retirements.read",
  ]);
  await grant(ROLE_CODES.RECONCILIATION_OFFICER, [
    "payments.reconcile", "payments.read",
  ]);
  console.log("✓ Permissions & roles");

  // —— 2. Organizations ——
  const orgDefs = [
    { code: "KG-MOF", name: "Ministry of Finance", type: "MINISTRY" as const },
    { code: "KG-PEN", name: "Kogi State Pension Board", type: "AGENCY" as const },
    { code: "KG-MOE", name: "Ministry of Education", type: "MINISTRY" as const },
    { code: "KG-MOH", name: "Ministry of Health", type: "MINISTRY" as const },
    { code: "KG-MOA", name: "Ministry of Agriculture", type: "MINISTRY" as const },
    { code: "KG-LGA-LKJ", name: "Lokoja LGA", type: "LGA" as const },
  ];
  const orgId: Record<string, string> = {};
  for (const o of orgDefs) {
    const row = await prisma.organization.upsert({
      where: { code: o.code },
      update: { name: o.name },
      create: { ...o, status: "ACTIVE" },
    });
    orgId[o.code] = row.id;
  }
  console.log("✓ Organizations");

  // —— 3. Users ——
  const pwd = await bcrypt.hash("ChangeMe@2026!", 12);
  async function user(
    email: string,
    username: string,
    staff: string,
    first: string,
    last: string,
    org: string,
    roleCode: string
  ) {
    const u = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: pwd, isActive: true },
      create: {
        email,
        username,
        staffNumber: staff,
        passwordHash: pwd,
        firstName: first,
        lastName: last,
        isActive: true,
        isEmailVerified: true,
        mustChangePassword: true,
        organizationId: orgId[org],
      },
    });
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: role.id } },
        update: {},
        create: { userId: u.id, roleId: role.id },
      });
    }
    return u;
  }

  const admin = await user("admin@kscspms.kg.gov.ng", "superadmin", "KG-ADMIN-001", "System", "Administrator", "KG-MOF", ROLE_CODES.SUPER_ADMIN);
  const records = await user("records@kscspms.kg.gov.ng", "records", "KG-REC-001", "Chinedu", "Okafor", "KG-PEN", ROLE_CODES.PENSION_RECORDS);
  const schedule = await user("schedule@kscspms.kg.gov.ng", "schedule", "KG-SCH-001", "Amina", "Yusuf", "KG-PEN", ROLE_CODES.SCHEDULE_PREP);
  const auditor = await user("auditor@kscspms.kg.gov.ng", "auditor", "KG-AUD-001", "Fatima", "Bello", "KG-PEN", ROLE_CODES.INTERNAL_AUDITOR);
  const dg = await user("dg@kscspms.kg.gov.ng", "dg", "KG-DG-001", "Musa", "Abdullahi", "KG-PEN", ROLE_CODES.DIRECTOR_GENERAL);
  const dfa = await user("dfa@kscspms.kg.gov.ng", "dfa", "KG-DFA-001", "Ngozi", "Eze", "KG-PEN", ROLE_CODES.DFA);
  const verifier = await user("verify@kscspms.kg.gov.ng", "verifier", "KG-VER-001", "Ibrahim", "Sule", "KG-PEN", ROLE_CODES.VERIFICATION_OFFICER);
  const support = await user("support@kscspms.kg.gov.ng", "support", "KG-CS-001", "Blessing", "Okoro", "KG-PEN", ROLE_CODES.CUSTOMER_SUPPORT);
  const finance = await user("finance@kscspms.kg.gov.ng", "finance", "KG-FIN-001", "Tunde", "Balogun", "KG-PEN", ROLE_CODES.FINANCE_OFFICER);
  const benefit = await user("benefits@kscspms.kg.gov.ng", "benefits", "KG-BEN-001", "Grace", "Adewale", "KG-PEN", ROLE_CODES.BENEFIT_CALC);
  console.log("✓ Users (password: ChangeMe@2026!)");

  // —— 4. Pension scheme & rules (Settings / Pension Rules) ——
  const scheme = await prisma.pensionScheme.upsert({
    where: { code: "KG-CSPS" },
    update: {},
    create: {
      name: "Kogi Civil Service Pension Scheme",
      code: "KG-CSPS",
      description: "State civil service pension scheme (demo)",
      isActive: true,
    },
  });
  await prisma.pensionRuleVersion.upsert({
    where: { schemeId_version: { schemeId: scheme.id, version: "DEMO-FACTOR-v1" } },
    update: {},
    create: {
      schemeId: scheme.id,
      version: "DEMO-FACTOR-v1",
      name: "Demo factor rules (testing only)",
      effectiveFrom: d("2020-01-01"),
      status: "APPROVED",
      rulesJson: {
        note: "DEMO ONLY",
        eligibilityMinYears: 10,
        monthlyPensionFactor: 0.5,
        gratuityPerYearOfService: 1,
      },
    },
  });
  console.log("✓ Pension scheme & rules");

  // —— 5. System settings ——
  const settings = [
    { key: "org.display_name", value: "Kogi State Civil Service Pension Board" },
    { key: "payment.currency", value: "NGN" },
    { key: "payment.gateway_mode", value: "demo" },
    { key: "intake.auto_pension_number", value: true },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value as object },
      create: { key: s.key, value: s.value as object, description: "Seed setting" },
    });
  }
  console.log("✓ Settings");

  // —— 6. People: New Placement, Active, Deceased ——
  type Person = {
    staff: string;
    pen: string;
    first: string;
    last: string;
    org: string;
    status: "PLACEMENT" | "ACTIVE" | "DECEASED";
    monthly: number;
    finalSalary: number;
    retire: string;
  };

  const people: Person[] = [
    { staff: "KG-EDU-88-001", pen: "PEN/KG/2025/1001", first: "Joseph", last: "Adamu", org: "KG-MOE", status: "ACTIVE", monthly: 140000, finalSalary: 280000, retire: "2024-06-30" },
    { staff: "KG-HLT-90-002", pen: "PEN/KG/2025/1002", first: "Mary", last: "Okonkwo", org: "KG-MOH", status: "ACTIVE", monthly: 125000, finalSalary: 250000, retire: "2024-08-31" },
    { staff: "KG-MOF-85-003", pen: "PEN/KG/2025/1003", first: "Samuel", last: "Ibrahim", org: "KG-MOF", status: "ACTIVE", monthly: 155000, finalSalary: 310000, retire: "2024-12-31" },
    { staff: "KG-EDU-95-004", pen: "PEN/KG/2025/1004", first: "Aisha", last: "Bello", org: "KG-MOE", status: "PLACEMENT", monthly: 98000, finalSalary: 196000, retire: "2025-03-31" },
    { staff: "KG-HLT-92-005", pen: "PEN/KG/2025/1005", first: "Peter", last: "Ojo", org: "KG-MOH", status: "PLACEMENT", monthly: 110000, finalSalary: 220000, retire: "2025-02-28" },
    { staff: "KG-MOA-91-006", pen: "PEN/KG/2025/1006", first: "Grace", last: "Ade", org: "KG-MOA", status: "PLACEMENT", monthly: 90000, finalSalary: 180000, retire: "2025-01-15" },
    { staff: "KG-MOF-80-007", pen: "PEN/KG/2023/2001", first: "Hassan", last: "Yusuf", org: "KG-MOF", status: "DECEASED", monthly: 145000, finalSalary: 290000, retire: "2020-01-31" },
    { staff: "KG-EDU-87-008", pen: "PEN/KG/2022/2002", first: "Ruth", last: "Eze", org: "KG-MOE", status: "DECEASED", monthly: 105000, finalSalary: 210000, retire: "2018-12-31" },
    { staff: "KG-LGA-89-009", pen: "PEN/KG/2025/1007", first: "Tunde", last: "Balogun", org: "KG-LGA-LKJ", status: "ACTIVE", monthly: 85000, finalSalary: 170000, retire: "2024-11-30" },
    { staff: "KG-PEN-93-010", pen: "PEN/KG/2025/1008", first: "Fatima", last: "Sule", org: "KG-PEN", status: "ACTIVE", monthly: 120000, finalSalary: 240000, retire: "2024-09-30" },
  ];

  const pensionerIds: Record<string, string> = {};

  for (const p of people) {
    if (await prisma.pensioner.findUnique({ where: { pensionerNumber: p.pen } })) {
      const existing = await prisma.pensioner.findUnique({ where: { pensionerNumber: p.pen } });
      if (existing) pensionerIds[p.pen] = existing.id;
      continue;
    }
    if (await prisma.employee.findUnique({ where: { staffNumber: p.staff } })) continue;

    const emp = await prisma.employee.create({
      data: {
        staffNumber: p.staff,
        firstName: p.first,
        lastName: p.last,
        dateOfBirth: d("1960-06-15"),
        gender: "Male",
        organizationId: orgId[p.org],
        employmentStatus: p.status === "DECEASED" ? "DECEASED" : "RETIRED",
        gradeLevel: "GL 12",
        jobTitle: "Senior Officer",
        appointmentDate: d("1990-01-01"),
      },
    });
    await prisma.serviceHistory.create({
      data: {
        employeeId: emp.id,
        organizationId: orgId[p.org],
        jobTitle: "Senior Officer",
        gradeLevel: "GL 12",
        startDate: d("1990-01-01"),
        endDate: d(p.retire),
        remarks: `Seed service history · final salary ${p.finalSalary}`,
      },
    });
    await prisma.salaryHistory.create({
      data: {
        employeeId: emp.id,
        gradeLevel: "GL 12",
        basicSalary: dec(p.finalSalary),
        totalEmolument: dec(p.finalSalary),
        effectiveDate: d(p.retire),
        remarks: "Final salary (seed)",
      },
    });

    const isDec = p.status === "DECEASED";
    const isPlace = p.status === "PLACEMENT";
    const pen = await prisma.pensioner.create({
      data: {
        pensionerNumber: p.pen,
        employeeId: emp.id,
        organizationId: orgId[p.org],
        pensionSchemeId: scheme.id,
        retirementDate: d(p.retire),
        enrolmentDate: isDec ? null : d("2025-01-10"),
        monthlyPension: dec(p.monthly),
        paymentStatus: isDec ? "DECEASED" : isPlace ? "PENDING" : "ACTIVE",
        placementStatus: isDec ? "DECEASED" : isPlace ? "NEW_PLACEMENT" : "ACTIVE",
        verificationStatus: isDec ? "VERIFIED" : isPlace ? "PENDING" : "VERIFIED",
        bankName: "First Bank of Nigeria",
        bankAccountNumber: `30${p.staff.slice(-6)}`,
        bankAccountName: `${p.first} ${p.last}`,
        dateOfDeath: isDec ? d("2025-06-01") : null,
        deathVerificationStatus: isDec ? "VERIFIED" : null,
        isActive: !isDec,
      },
    });
    pensionerIds[p.pen] = pen.id;

    if (isPlace) {
      await prisma.placementRecord.create({
        data: {
          pensionerId: pen.id,
          category: "NEW_PLACEMENT",
          status: "PENDING",
          outstandingRequirements: "Seed: documents & verification",
          createdById: records.id,
        },
      });
    } else if (!isDec) {
      await prisma.placementRecord.create({
        data: {
          pensionerId: pen.id,
          category: "NEW_PLACEMENT",
          status: "ACTIVATED",
          placementDate: d("2024-07-01"),
          activationDate: d("2024-08-01"),
          createdById: records.id,
        },
      });
    }
  }
  console.log("✓ Pensioners / placements / deceased");

  // —— 7. Retirement cases & benefits ——
  const activePen = await prisma.pensioner.findFirst({
    where: { pensionerNumber: "PEN/KG/2025/1001" },
    include: { employee: true },
  });
  if (activePen?.employeeId) {
    const ref = "RET-SEED-2025-001";
    let rc = await prisma.retirementCase.findFirst({ where: { caseReference: ref } });
    if (!rc) {
      rc = await prisma.retirementCase.create({
        data: {
          caseReference: ref,
          employeeId: activePen.employeeId,
          pensionSchemeId: scheme.id,
          retirementCategory: "STATUTORY",
          expectedRetirementDate: activePen.retirementDate || d("2024-06-30"),
          actualRetirementDate: activePen.retirementDate || d("2024-06-30"),
          currentStage: "CLOSED",
          status: "CLOSED",
          createdById: records.id,
          notes: "Seed retirement case",
        },
      });
      await prisma.retirementTimeline.create({
        data: {
          retirementCaseId: rc.id,
          stage: "ELIGIBILITY_ASSESSMENT",
          action: "CASE_OPENED",
          comments: "Seed retirement case",
          performedById: records.id,
        },
      });
      await prisma.benefitAssessment.create({
        data: {
          retirementCaseId: rc.id,
          assessmentRef: "BA-SEED-001",
          status: "APPROVED",
          monthlyPension: dec(140000),
          gratuityAmount: dec(2800000),
          netEntitlement: dec(2800000),
          finalSalary: dec(280000),
          qualifyingServiceYears: dec(34),
          assessedById: benefit.id,
          approvedById: dg.id,
          assessedAt: d("2024-07-10"),
          approvedAt: d("2024-07-15"),
          calculationInputs: { method: "FACTOR", demo: true },
        },
      });
    }
  }
  console.log("✓ Retirements & benefits");

  // —— 8. Verification ——
  const placePen = await prisma.pensioner.findFirst({
    where: { pensionerNumber: "PEN/KG/2025/1004" },
  });
  if (placePen) {
    const vref = "VER-SEED-001";
    const exists = await prisma.verificationCase.findFirst({ where: { reference: vref } });
    if (!exists) {
      await prisma.verificationCase.create({
        data: {
          reference: vref,
          pensionerId: placePen.id,
          verificationType: "LIFE",
          status: "PENDING",
          assignedOfficerId: verifier.id,
        },
      });
    }
  }
  console.log("✓ Verification");

  // —— 9. Gratuity ——
  if (activePen) {
    const g = await prisma.gratuityEntitlement.findUnique({
      where: { pensionerId: activePen.id },
    });
    if (!g) {
      const ent = await prisma.gratuityEntitlement.create({
        data: {
          pensionerId: activePen.id,
          approvedAmount: dec(2800000),
          currency: "NGN",
          status: "ACTIVE",
          approvedById: dg.id,
          approvedAt: d("2024-07-20"),
        },
      });
      await prisma.gratuityInstallment.create({
        data: {
          entitlementId: ent.id,
          installmentNo: 1,
          proposedAmount: dec(1000000),
          paidAmount: dec(1000000),
          status: "PAID",
          paidAt: d("2024-08-15"),
          notes: "Seed paid instalment",
        },
      });
      await prisma.gratuityInstallment.create({
        data: {
          entitlementId: ent.id,
          installmentNo: 2,
          proposedAmount: dec(900000),
          status: "PROPOSED",
        },
      });
    }
  }
  console.log("✓ Gratuity");

  // —— 10. NOK claims ——
  const decPen = await prisma.pensioner.findFirst({
    where: { pensionerNumber: "PEN/KG/2023/2001" },
  });
  if (decPen) {
    const nref = "NOK-SEED-001";
    if (!(await prisma.nextOfKinClaim.findFirst({ where: { reference: nref } }))) {
      await prisma.nextOfKinClaim.create({
        data: {
          reference: nref,
          pensionerId: decPen.id,
          claimantName: "Amina Yusuf",
          relationship: "SPOUSE",
          claimType: "GRATUITY",
          amountClaimed: dec(500000),
          status: "SUBMITTED",
        },
      });
    }
  }
  console.log("✓ Beneficiary claims");

  // —— 11. Payment schedules (workflow stages) ——
  async function ensureSchedule(
    ref: string,
    period: string,
    stage: string,
    status: string,
    preparedById: string
  ) {
    let s = await prisma.paymentSchedule.findFirst({ where: { scheduleRef: ref } });
    if (s) return s;
    const actives = await prisma.pensioner.findMany({
      where: { paymentStatus: "ACTIVE", placementStatus: "ACTIVE", isActive: true },
      take: 5,
    });
    let total = 0;
    const [yy, mm] = period.split("-").map(Number);
    const periodStart = new Date(Date.UTC(yy, mm - 1, 1));
    const periodEnd = new Date(Date.UTC(yy, mm, 0, 23, 59, 59));
    s = await prisma.paymentSchedule.create({
      data: {
        scheduleRef: ref,
        paymentPeriod: period,
        periodStart,
        periodEnd,
        notes: `Seed schedule ${period}`,
        status,
        workflowStage: stage,
        preparedById,
        totalAmount: dec(0),
        totalItems: actives.length,
        source: "MANUAL",
      },
    });
    for (const pen of actives) {
      const amt = Number(pen.monthlyPension || 100000);
      total += amt;
      await prisma.paymentScheduleItem.create({
        data: {
          scheduleId: s.id,
          pensionerId: pen.id,
          amount: dec(amt),
          netAmount: dec(amt),
          status: stage === "COMPLETED" ? "PAID" : "PENDING",
        },
      });
    }
    await prisma.paymentSchedule.update({
      where: { id: s.id },
      data: { totalAmount: dec(total) },
    });
    return s;
  }

  await ensureSchedule("SCH-SEED-2025-01", "2025-01", "INTERNAL_AUDIT", "PENDING_APPROVAL", schedule.id);
  await ensureSchedule("SCH-SEED-2025-02", "2025-02", "DG_APPROVAL", "PENDING_APPROVAL", schedule.id);
  const dfaSched = await ensureSchedule("SCH-SEED-2025-03", "2025-03", "DFA_PAYMENT", "APPROVED", schedule.id);
  const doneSched = await ensureSchedule("SCH-SEED-2024-12", "2024-12", "COMPLETED", "COMPLETED", schedule.id);

  if (dfaSched) {
    const code = "ASM-SEED-2025-03";
    if (!(await prisma.paymentAssessment.findUnique({ where: { assessmentCode: code } }))) {
      await prisma.paymentAssessment.create({
        data: {
          assessmentCode: code,
          scheduleId: dfaSched.id,
          paymentPeriod: "2025-03",
          description: "Seed assessment ready for DFA",
          totalAmount: dfaSched.totalAmount,
          totalItems: dfaSched.totalItems,
          status: "READY",
          generatedById: dfa.id,
          generatedAt: new Date(),
        },
      });
    }
  }
  if (doneSched) {
    const exists = await prisma.paymentReconciliation.findFirst({
      where: { scheduleId: doneSched.id },
    });
    if (!exists) {
      await prisma.paymentReconciliation.create({
        data: {
          reference: `REC-${doneSched.scheduleRef}`,
          scheduleId: doneSched.id,
          status: "MATCHED",
          expectedAmount: doneSched.totalAmount,
          actualAmount: doneSched.totalAmount,
          variance: dec(0),
          matchedItems: doneSched.totalItems,
          reconciledById: finance.id,
          reconciledAt: d("2025-01-05"),
          notes: "Seed reconciliation — matched",
        },
      });
    }
  }
  console.log("✓ Payment schedules, assessment, reconciliation");

  // —— 12. Arrears ——
  if (activePen) {
    const aref = "ARR-SEED-001";
    if (!(await prisma.arrear.findFirst({ where: { reference: aref } }))) {
      await prisma.arrear.create({
        data: {
          reference: aref,
          pensionerId: activePen.id,
          periodFrom: "2024-07",
          periodTo: "2024-08",
          monthsCount: 2,
          monthlyAmount: dec(140000),
          totalAmount: dec(280000),
          reason: "Enrolment lag (seed)",
          status: "APPROVED",
          approvedById: dg.id,
          approvedAt: d("2024-09-01"),
          createdById: records.id,
        },
      });
    }
  }
  console.log("✓ Arrears");

  // —— 13. Bank detail change ——
  if (activePen) {
    const pending = await prisma.bankDetailChange.findFirst({
      where: { pensionerId: activePen.id, status: "PENDING" },
    });
    if (!pending) {
      await prisma.bankDetailChange.create({
        data: {
          pensionerId: activePen.id,
          previousBankName: activePen.bankName,
          previousAccountNumber: activePen.bankAccountNumber,
          previousAccountName: activePen.bankAccountName,
          newBankName: "Access Bank",
          newAccountNumber: "0123456789",
          newAccountName: activePen.bankAccountName,
          reason: "Account migration (seed)",
          status: "PENDING",
          requestedById: records.id,
        },
      });
    }
  }
  console.log("✓ Bank detail changes");

  // —— 14. Complaints ——
  if (activePen) {
    const cref = "CMP-SEED-001";
    if (!(await prisma.complaint.findFirst({ where: { reference: cref } }))) {
      await prisma.complaint.create({
        data: {
          reference: cref,
          pensionerId: activePen.id,
          subject: "Query on January payment",
          description: "Seed complaint — pensioner seeks clarification on deduction",
          status: "OPEN",
          priority: "MEDIUM",
          category: "PAYMENT",
          assignedOfficerId: support.id,
        },
      });
    }
  }
  console.log("✓ Complaints");

  // —— 15. Notifications ——
  for (const u of [admin, records, schedule, dfa]) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        title: "Welcome to KSCSPMS (seed)",
        message: "Demo environment seeded. Explore modules from the dashboard.",
        type: "INFO",
        isRead: false,
      },
    });
  }
  console.log("✓ Notifications");

  // —— 16. Import batch sample ——
  const batchRef = "IMP-SEED-DEMO-001";
  if (!(await prisma.importBatch.findUnique({ where: { batchRef } }))) {
    const b = await prisma.importBatch.create({
      data: {
        batchRef,
        module: "INTAKE",
        originalFilename: "seed-demo.csv",
        templateVersion: "v1",
        status: "COMPLETED",
        totalRows: 2,
        validRows: 2,
        createdCount: 0,
        skippedCount: 2,
        failedCount: 0,
        uploadedById: records.id,
        completedAt: new Date(),
        errorSummary: "Demo batch — rows skipped as synthetic history",
      },
    });
    await prisma.importBatchRow.create({
      data: {
        batchId: b.id,
        rowNumber: 2,
        status: "SKIPPED",
        errorMessage: "Demo import history row",
      },
    });
  }
  console.log("✓ Import history");

  // —— 17. Audit + activity ——
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: "SYSTEM.SEED_FULL",
      entityType: "System",
      entityId: "seed",
      afterValues: { note: "Full system seed completed", outcome: "SUCCESS" },
    },
  });
  if (activePen) {
    await prisma.recordActivity.create({
      data: {
        entityType: "Pensioner",
        entityId: activePen.id,
        eventType: "SEED",
        summary: "Created by full system seed",
        actorId: admin.id,
        actorEmail: admin.email,
      },
    });
  }
  console.log("✓ Audit logs");

  console.log("\n========== SEED COMPLETE ==========");
  console.log("Password for all users: ChangeMe@2026!");
  console.log("admin@kscspms.kg.gov.ng          Super Admin");
  console.log("records@kscspms.kg.gov.ng        Records");
  console.log("schedule@kscspms.kg.gov.ng       Schedule Prep");
  console.log("auditor@kscspms.kg.gov.ng        Internal Auditor");
  console.log("dg@kscspms.kg.gov.ng             DG");
  console.log("dfa@kscspms.kg.gov.ng            DFA");
  console.log("verify@kscspms.kg.gov.ng         Verification");
  console.log("support@kscspms.kg.gov.ng        Support");
  console.log("===================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
