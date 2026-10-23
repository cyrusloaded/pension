/**
 * Full demo seed for KSCSPMS — populates all major modules.
 * Run: npm run db:seed
 */
import { PrismaClient, EmploymentStatus, RetirementStage } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_CODES } from "../src/lib/permissions/constants";

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);

async function main() {
  console.log("Seeding KSCSPMS (full demo dataset)...\n");

  const permissionList = Object.values(PERMISSIONS);
  for (const code of permissionList) {
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
  console.log(`✓ ${permissionList.length} permissions`);

  const rolesData = [
    { code: ROLE_CODES.SUPER_ADMIN, name: "Super Administrator", isSystem: true },
    { code: ROLE_CODES.SYSTEM_ADMIN, name: "System Administrator", isSystem: true },
    { code: ROLE_CODES.PENSION_DIRECTOR, name: "Pension Director", isSystem: true },
    { code: ROLE_CODES.PENSION_ADMIN, name: "Pension Administrator", isSystem: true },
    { code: ROLE_CODES.HR_OFFICER, name: "HR Officer", isSystem: true },
    { code: ROLE_CODES.MDA_RECORDS, name: "MDA Records Officer", isSystem: true },
    { code: ROLE_CODES.LGA_RECORDS, name: "LGA Records Officer", isSystem: true },
    { code: ROLE_CODES.VERIFICATION_OFFICER, name: "Verification Officer", isSystem: true },
    { code: ROLE_CODES.BENEFIT_CALC, name: "Benefit Calculation Officer", isSystem: true },
    { code: ROLE_CODES.BENEFIT_REVIEWER, name: "Benefit Reviewer", isSystem: true },
    { code: ROLE_CODES.APPROVAL_OFFICER, name: "Approval Officer", isSystem: true },
    { code: ROLE_CODES.FINANCE_OFFICER, name: "Finance Officer", isSystem: true },
    { code: ROLE_CODES.PAYMENT_AUTHORIZER, name: "Payment Authorizer", isSystem: true },
    { code: ROLE_CODES.RECONCILIATION_OFFICER, name: "Reconciliation Officer", isSystem: true },
    { code: ROLE_CODES.INTERNAL_AUDITOR, name: "Internal Auditor", isSystem: true },
    { code: ROLE_CODES.CUSTOMER_SUPPORT, name: "Customer Support Officer", isSystem: true },
    { code: ROLE_CODES.READ_ONLY, name: "Read-Only Officer", isSystem: true },
    { code: ROLE_CODES.PENSIONER, name: "Pensioner", isSystem: true },
    { code: ROLE_CODES.PENSION_RECORDS, name: "Pension Records Officer", isSystem: true },
    { code: ROLE_CODES.SCHEDULE_PREP, name: "Schedule Preparation Officer", isSystem: true },
    { code: ROLE_CODES.DIRECTOR_GENERAL, name: "Director-General / Approver", isSystem: true },
    { code: ROLE_CODES.DFA, name: "Director of Finance and Accounts", isSystem: true },
    { code: ROLE_CODES.CASHIER, name: "Cashier / Accounts Officer", isSystem: true },
  ];

  for (const r of rolesData) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: {},
      create: { code: r.code, name: r.name, description: r.name, isSystem: r.isSystem },
    });
  }
  console.log(`✓ ${rolesData.length} roles`);

  const allPerms = await prisma.permission.findMany();
  const roleByCode = (code: string) => prisma.role.findUniqueOrThrow({ where: { code } });

  const superAdminRole = await roleByCode(ROLE_CODES.SUPER_ADMIN);
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: p.id },
    });
  }

  const readOnlyRole = await roleByCode(ROLE_CODES.READ_ONLY);
  for (const p of allPerms.filter((x) => x.code.endsWith(".read") || x.code.includes("view"))) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: readOnlyRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: readOnlyRole.id, permissionId: p.id },
    });
  }

  async function grant(roleCode: string, codes: string[]) {
    const role = await roleByCode(roleCode);
    for (const code of codes) {
      const perm = allPerms.find((p) => p.code === code);
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  await grant(ROLE_CODES.HR_OFFICER, ["employees.read", "employees.create", "employees.update", "retirements.read", "retirements.create"]);
  await grant(ROLE_CODES.MDA_RECORDS, ["employees.read", "employees.create", "employees.update", "retirements.read", "retirements.create", "retirements.review"]);
  await grant(ROLE_CODES.VERIFICATION_OFFICER, ["verification.read", "verification.manage", "pensioners.read", "employees.read"]);
  await grant(ROLE_CODES.BENEFIT_CALC, ["benefits.calculate", "retirements.read", "retirements.review", "employees.read"]);
  await grant(ROLE_CODES.BENEFIT_REVIEWER, ["benefits.review", "retirements.read", "employees.read"]);
  await grant(ROLE_CODES.APPROVAL_OFFICER, ["benefits.approve", "retirements.read", "retirements.review"]);
  await grant(ROLE_CODES.FINANCE_OFFICER, ["payments.prepare", "payments.read", "pensioners.read", "reports.view"]);
  await grant(ROLE_CODES.PAYMENT_AUTHORIZER, ["payments.authorize", "payments.read", "reports.view"]);
  await grant(ROLE_CODES.RECONCILIATION_OFFICER, ["payments.reconcile", "payments.read"]);
  await grant(ROLE_CODES.CUSTOMER_SUPPORT, ["complaints.read", "complaints.manage", "pensioners.read"]);
  await grant(ROLE_CODES.PENSION_ADMIN, ["employees.read", "pensioners.read", "pensioners.create", "pensioners.update", "retirements.read", "retirements.review", "reports.view", "reports.export"]);
  await grant(ROLE_CODES.INTERNAL_AUDITOR, ["audit.read", "reports.view", "reports.export", "employees.read", "pensioners.read", "payments.read"]);

  await grant(ROLE_CODES.PENSION_RECORDS, [
    "pensioners.read", "pensioners.create", "pensioners.update",
    "employees.read", "payments.prepare", "payments.read",
    "placements.read", "placements.manage", "gratuity.read",
    "retirements.read", "reports.view",
  ]);
  await grant(ROLE_CODES.SCHEDULE_PREP, [
    "payments.prepare", "payments.read", "pensioners.read",
    "gratuity.read", "gratuity.manage", "reports.view",
  ]);
  await grant(ROLE_CODES.INTERNAL_AUDITOR, [
    "schedule.audit", "audit.read", "payments.read", "pensioners.read",
    "employees.read", "gratuity.read", "reports.view", "reports.export",
  ]);
  await grant(ROLE_CODES.DIRECTOR_GENERAL, [
    "schedule.dg_approve", "payments.authorize", "payments.read",
    "pensioners.read", "gratuity.read", "reports.view", "benefits.approve",
  ]);
  await grant(ROLE_CODES.DFA, [
    "schedule.dfa_pay", "payments.authorize", "payments.read",
    "payments.reconcile", "gratuity.manage", "gratuity.read", "reports.view",
  ]);
  await grant(ROLE_CODES.CASHIER, [
    "payments.read", "schedule.dfa_pay", "pensioners.read",
  ]);

  console.log("✓ Role–permission matrix");

  const mof = await prisma.organization.upsert({
    where: { code: "KG-MOF" },
    update: {},
    create: { name: "Ministry of Finance", code: "KG-MOF", type: "MINISTRY", status: "ACTIVE", address: "Lokoja, Kogi State", phone: "+234-803-000-0001", email: "mof@kogistate.gov.ng" },
  });
  const penBoard = await prisma.organization.upsert({
    where: { code: "KG-PEN" },
    update: {},
    create: { name: "Kogi State Pension Board", code: "KG-PEN", type: "AGENCY", status: "ACTIVE", parentId: mof.id, address: "Pension House, Lokoja", phone: "+234-803-000-0002", email: "pensions@kogistate.gov.ng" },
  });
  const moe = await prisma.organization.upsert({
    where: { code: "KG-MOE" },
    update: {},
    create: { name: "Ministry of Education", code: "KG-MOE", type: "MINISTRY", status: "ACTIVE", address: "Lokoja, Kogi State" },
  });
  const moh = await prisma.organization.upsert({
    where: { code: "KG-MOH" },
    update: {},
    create: { name: "Ministry of Health", code: "KG-MOH", type: "MINISTRY", status: "ACTIVE" },
  });
  const lgaLokoja = await prisma.organization.upsert({
    where: { code: "LGA-LOKOJA" },
    update: {},
    create: { name: "Lokoja Local Government", code: "LGA-LOKOJA", type: "LGA", status: "ACTIVE", lgaCode: "LOKOJA" },
  });
  await prisma.organization.upsert({
    where: { code: "LGA-OKENE" },
    update: {},
    create: { name: "Okene Local Government", code: "LGA-OKENE", type: "LGA", status: "ACTIVE", lgaCode: "OKENE" },
  });
  await prisma.organization.upsert({
    where: { code: "LGA-ANKPA" },
    update: {},
    create: { name: "Ankpa Local Government", code: "LGA-ANKPA", type: "LGA", status: "ACTIVE", lgaCode: "ANKPA" },
  });
  console.log("✓ Organizations (7)");

  const scheme = await prisma.pensionScheme.upsert({
    where: { code: "CPS-KOGI" },
    update: {},
    create: {
      name: "Kogi State Civil Service Pension Scheme",
      code: "CPS-KOGI",
      description: "Primary scheme for Kogi State civil servants. Includes demo FACTOR rules for testing.",
      isActive: true,
    },
  });

  await prisma.pensionRuleVersion.upsert({
    where: { schemeId_version: { schemeId: scheme.id, version: "PLACEHOLDER-v1" } },
    update: {},
    create: {
      schemeId: scheme.id,
      version: "PLACEHOLDER-v1",
      name: "Official placeholder rules",
      effectiveFrom: d("2004-06-25"),
      status: "APPROVED",
      rulesJson: {
        note: "OFFICIAL RULES NOT YET CONFIGURED",
        eligibilityMinYears: 10,
        calculationMethod: "PLACEHOLDER",
        monthlyPensionFactor: null,
        gratuityPerYearOfService: null,
        rounding: "NEAREST_NAIRA",
      },
    },
  });

  const factorRules = await prisma.pensionRuleVersion.upsert({
    where: { schemeId_version: { schemeId: scheme.id, version: "DEMO-FACTOR-v1" } },
    update: {},
    create: {
      schemeId: scheme.id,
      version: "DEMO-FACTOR-v1",
      name: "Demo factor rules (testing only)",
      effectiveFrom: d("2020-01-01"),
      status: "APPROVED",
      rulesJson: {
        note: "DEMO ONLY — replace with official circular parameters",
        eligibilityMinYears: 10,
        calculationMethod: "FACTOR",
        monthlyPensionFactor: 0.5,
        gratuityPerYearOfService: 1,
        rounding: "NEAREST_NAIRA",
      },
    },
  });

  await prisma.pensionRuleVersion.upsert({
    where: { schemeId_version: { schemeId: scheme.id, version: "DRAFT-v2" } },
    update: {},
    create: {
      schemeId: scheme.id,
      version: "DRAFT-v2",
      name: "Draft rules pending approval",
      effectiveFrom: d("2026-01-01"),
      status: "DRAFT",
      rulesJson: {
        calculationMethod: "FACTOR",
        monthlyPensionFactor: 0.55,
        gratuityPerYearOfService: 1.1,
        rounding: "NEAREST_NAIRA",
      },
    },
  });
  console.log("✓ Pension scheme + 3 rule versions");

  const pwd = await bcrypt.hash("ChangeMe@2026!", 12);

  async function ensureUser(data: {
    email: string;
    username: string;
    staffNumber: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    roleCode: string;
  }) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        username: data.username,
        staffNumber: data.staffNumber,
        passwordHash: pwd,
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: true,
        isEmailVerified: true,
        mustChangePassword: true,
        organizationId: data.organizationId,
      },
    });
    const role = await roleByCode(data.roleCode);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    return user;
  }

  const admin = await ensureUser({
    email: "admin@kscspms.kg.gov.ng",
    username: "superadmin",
    staffNumber: "KG-ADMIN-001",
    firstName: "System",
    lastName: "Administrator",
    organizationId: mof.id,
    roleCode: ROLE_CODES.SUPER_ADMIN,
  });
  const hrUser = await ensureUser({
    email: "hr@kscspms.kg.gov.ng",
    username: "hrofficer",
    staffNumber: "KG-HR-001",
    firstName: "Amina",
    lastName: "Yusuf",
    organizationId: moe.id,
    roleCode: ROLE_CODES.HR_OFFICER,
  });
  const recordsUser = await ensureUser({
    email: "records@kscspms.kg.gov.ng",
    username: "mdarecords",
    staffNumber: "KG-REC-001",
    firstName: "Chinedu",
    lastName: "Okafor",
    organizationId: moh.id,
    roleCode: ROLE_CODES.MDA_RECORDS,
  });
  const verifyUser = await ensureUser({
    email: "verify@kscspms.kg.gov.ng",
    username: "verifier",
    staffNumber: "KG-VER-001",
    firstName: "Fatima",
    lastName: "Bello",
    organizationId: penBoard.id,
    roleCode: ROLE_CODES.VERIFICATION_OFFICER,
  });
  const benefitUser = await ensureUser({
    email: "benefits@kscspms.kg.gov.ng",
    username: "benefitcalc",
    staffNumber: "KG-BEN-001",
    firstName: "Ibrahim",
    lastName: "Sule",
    organizationId: penBoard.id,
    roleCode: ROLE_CODES.BENEFIT_CALC,
  });
  const reviewUser = await ensureUser({
    email: "review@kscspms.kg.gov.ng",
    username: "benefitreview",
    staffNumber: "KG-REV-001",
    firstName: "Grace",
    lastName: "Adewale",
    organizationId: penBoard.id,
    roleCode: ROLE_CODES.BENEFIT_REVIEWER,
  });
  const approveUser = await ensureUser({
    email: "approve@kscspms.kg.gov.ng",
    username: "approver",
    staffNumber: "KG-APP-001",
    firstName: "Musa",
    lastName: "Abdullahi",
    organizationId: penBoard.id,
    roleCode: ROLE_CODES.APPROVAL_OFFICER,
  });
  const financeUser = await ensureUser({
    email: "finance@kscspms.kg.gov.ng",
    username: "finance",
    staffNumber: "KG-FIN-001",
    firstName: "Ngozi",
    lastName: "Eze",
    organizationId: penBoard.id,
    roleCode: ROLE_CODES.FINANCE_OFFICER,
  });
  const payAuthUser = await ensureUser({
    email: "payauth@kscspms.kg.gov.ng",
    username: "payauth",
    staffNumber: "KG-PAY-001",
    firstName: "Tunde",
    lastName: "Balogun",
    organizationId: penBoard.id,
    roleCode: ROLE_CODES.PAYMENT_AUTHORIZER,
  });
  const supportUser = await ensureUser({
    email: "support@kscspms.kg.gov.ng",
    username: "support",
    staffNumber: "KG-CS-001",
    firstName: "Blessing",
    lastName: "Okoro",
    organizationId: penBoard.id,
    roleCode: ROLE_CODES.CUSTOMER_SUPPORT,
  });
  const pensionerPortalUser = await ensureUser({
    email: "pensioner.demo@kscspms.kg.gov.ng",
    username: "pensioner1",
    staffNumber: "KG-PEN-USER-001",
    firstName: "Joseph",
    lastName: "Adamu",
    organizationId: moe.id,
    roleCode: ROLE_CODES.PENSIONER,
  });
  console.log("✓ Users (11) — password: ChangeMe@2026!");

  async function ensureEmployee(data: {
    staffNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;
    gender: string;
    organizationId: string;
    jobTitle: string;
    gradeLevel: string;
    step: number;
    status: EmploymentStatus;
    appointmentDate: string;
    nin?: string;
    phone?: string;
    email?: string;
  }) {
    return prisma.employee.upsert({
      where: { staffNumber: data.staffNumber },
      update: {},
      create: {
        staffNumber: data.staffNumber,
        title: data.gender === "FEMALE" ? "Mrs" : "Mr",
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        dateOfBirth: d(data.dateOfBirth),
        gender: data.gender,
        maritalStatus: "MARRIED",
        nationality: "Nigerian",
        stateOfOrigin: "Kogi",
        organizationId: data.organizationId,
        employmentCategory: "PERMANENT",
        appointmentDate: d(data.appointmentDate),
        confirmationDate: d(data.appointmentDate),
        jobTitle: data.jobTitle,
        gradeLevel: data.gradeLevel,
        step: data.step,
        employmentStatus: data.status,
        pensionSchemeId: scheme.id,
        nin: data.nin,
        phone: data.phone,
        email: data.email,
        nextOfKinName: "Next of Kin",
        nextOfKinPhone: "+234-800-000-0000",
        nextOfKinRelationship: "Spouse",
        createdById: admin.id,
      },
    });
  }

  const empActive1 = await ensureEmployee({
    staffNumber: "KG/EDU/1998/0142",
    firstName: "Mary",
    lastName: "Ibrahim",
    middleName: "Ojo",
    dateOfBirth: "1970-03-15",
    gender: "FEMALE",
    organizationId: moe.id,
    jobTitle: "Principal Education Officer",
    gradeLevel: "GL14",
    step: 5,
    status: "ACTIVE",
    appointmentDate: "1998-06-01",
    nin: "12345678901",
    phone: "+234-801-111-0001",
    email: "mary.ibrahim@moe.kg.gov.ng",
  });
  const empActive2 = await ensureEmployee({
    staffNumber: "KG/HLT/2001/0088",
    firstName: "Samuel",
    lastName: "Okeke",
    dateOfBirth: "1975-11-20",
    gender: "MALE",
    organizationId: moh.id,
    jobTitle: "Chief Nursing Officer",
    gradeLevel: "GL13",
    step: 4,
    status: "ACTIVE",
    appointmentDate: "2001-02-15",
    nin: "12345678902",
    phone: "+234-801-111-0002",
  });
  const empRetiring = await ensureEmployee({
    staffNumber: "KG/EDU/1990/0031",
    firstName: "Hassan",
    lastName: "Mohammed",
    dateOfBirth: "1961-08-10",
    gender: "MALE",
    organizationId: moe.id,
    jobTitle: "Director of Schools",
    gradeLevel: "GL16",
    step: 8,
    status: "ACTIVE",
    appointmentDate: "1990-01-10",
    nin: "12345678903",
    phone: "+234-801-111-0003",
  });
  const empRetired = await ensureEmployee({
    staffNumber: "KG/EDU/1985/0007",
    firstName: "Joseph",
    lastName: "Adamu",
    middleName: "K.",
    dateOfBirth: "1960-01-05",
    gender: "MALE",
    organizationId: moe.id,
    jobTitle: "Deputy Director",
    gradeLevel: "GL15",
    step: 9,
    status: "RETIRED",
    appointmentDate: "1985-03-01",
    nin: "12345678904",
    phone: "+234-801-111-0004",
    email: "pensioner.demo@kscspms.kg.gov.ng",
  });
  const empLga = await ensureEmployee({
    staffNumber: "LGA/LOK/2005/0210",
    firstName: "Ruth",
    lastName: "Abdulkareem",
    dateOfBirth: "1980-07-22",
    gender: "FEMALE",
    organizationId: lgaLokoja.id,
    jobTitle: "Senior Administrative Officer",
    gradeLevel: "GL10",
    step: 3,
    status: "ACTIVE",
    appointmentDate: "2005-09-01",
    nin: "12345678905",
  });
  const lgaOkene = await prisma.organization.findUniqueOrThrow({ where: { code: "LGA-OKENE" } });
  await ensureEmployee({
    staffNumber: "LGA/OKE/1999/0044",
    firstName: "Peter",
    lastName: "Ojima",
    dateOfBirth: "1968-12-01",
    gender: "MALE",
    organizationId: lgaOkene.id,
    jobTitle: "Works Superintendent",
    gradeLevel: "GL12",
    step: 6,
    status: "ACTIVE",
    appointmentDate: "1999-04-20",
    nin: "12345678906",
  });
  console.log("✓ Employees (6)");

  async function addService(employeeId: string, orgId: string, jobTitle: string, grade: string, start: string, end?: string) {
    const existing = await prisma.serviceHistory.findFirst({ where: { employeeId, jobTitle, startDate: d(start) } });
    if (existing) return;
    await prisma.serviceHistory.create({
      data: {
        employeeId,
        organizationId: orgId,
        jobTitle,
        gradeLevel: grade,
        startDate: d(start),
        endDate: end ? d(end) : null,
        isCurrent: !end,
      },
    });
  }

  async function addSalary(employeeId: string, grade: string, step: number, basic: number, effective: string) {
    const existing = await prisma.salaryHistory.findFirst({ where: { employeeId, effectiveDate: d(effective) } });
    if (existing) return;
    await prisma.salaryHistory.create({
      data: {
        employeeId,
        gradeLevel: grade,
        step,
        basicSalary: basic,
        allowances: basic * 0.35,
        totalEmolument: basic * 1.35,
        effectiveDate: d(effective),
        remarks: "SEED",
      },
    });
  }

  await addService(empActive1.id, moe.id, "Education Officer", "GL08", "1998-06-01", "2005-12-31");
  await addService(empActive1.id, moe.id, "Senior Education Officer", "GL12", "2006-01-01", "2015-12-31");
  await addService(empActive1.id, moe.id, "Principal Education Officer", "GL14", "2016-01-01");
  await addSalary(empActive1.id, "GL14", 5, 180000, "2024-01-01");
  await addService(empActive2.id, moh.id, "Nursing Officer", "GL08", "2001-02-15", "2010-12-31");
  await addService(empActive2.id, moh.id, "Chief Nursing Officer", "GL13", "2011-01-01");
  await addSalary(empActive2.id, "GL13", 4, 165000, "2024-01-01");
  await addService(empRetiring.id, moe.id, "Education Officer", "GL08", "1990-01-10", "2000-12-31");
  await addService(empRetiring.id, moe.id, "Director of Schools", "GL16", "2015-01-01");
  await addSalary(empRetiring.id, "GL16", 8, 320000, "2024-01-01");
  await addService(empRetired.id, moe.id, "Teacher", "GL07", "1985-03-01", "1995-12-31");
  await addService(empRetired.id, moe.id, "Deputy Director", "GL15", "2010-01-01", "2024-12-31");
  await addSalary(empRetired.id, "GL15", 9, 280000, "2023-01-01");
  await addService(empLga.id, lgaLokoja.id, "Administrative Officer", "GL08", "2005-09-01");
  await addSalary(empLga.id, "GL10", 3, 95000, "2024-01-01");
  console.log("✓ Service & salary history");

  for (const [emp, dtype, fname] of [
    [empActive1, "APPOINTMENT_LETTER", "appointment-mary.pdf"],
    [empRetiring, "BIRTH_CERTIFICATE", "birth-hassan.pdf"],
    [empRetired, "RETIREMENT_NOTICE", "retirement-joseph.pdf"],
  ] as const) {
    const exists = await prisma.employeeDocument.findFirst({ where: { employeeId: emp.id, documentType: dtype } });
    if (!exists) {
      await prisma.employeeDocument.create({
        data: {
          employeeId: emp.id,
          documentType: dtype,
          fileName: fname,
          filePath: `seed/employees/${fname}`,
          verificationStatus: "VERIFIED",
        },
      });
    }
  }

  const caseOpen = await prisma.retirementCase.upsert({
    where: { caseReference: "RC-2026-0001" },
    update: {},
    create: {
      caseReference: "RC-2026-0001",
      employeeId: empRetiring.id,
      pensionSchemeId: scheme.id,
      retirementCategory: "AGE",
      expectedRetirementDate: d("2026-08-10"),
      currentStage: "CASE_REVIEW" as RetirementStage,
      status: "OPEN",
      assignedOfficerId: recordsUser.id,
      notes: "Demo open retirement case for Hassan Mohammed",
      createdById: hrUser.id,
    },
  });

  const caseEnrolled = await prisma.retirementCase.upsert({
    where: { caseReference: "RC-2024-0088" },
    update: {},
    create: {
      caseReference: "RC-2024-0088",
      employeeId: empRetired.id,
      pensionSchemeId: scheme.id,
      retirementCategory: "AGE",
      expectedRetirementDate: d("2024-12-31"),
      actualRetirementDate: d("2024-12-31"),
      currentStage: "CLOSED" as RetirementStage,
      status: "CLOSED",
      assignedOfficerId: approveUser.id,
      notes: "Completed demo retirement — Joseph Adamu",
      createdById: hrUser.id,
    },
  });

  await prisma.retirementCase.upsert({
    where: { caseReference: "RC-2026-0015" },
    update: {},
    create: {
      caseReference: "RC-2026-0015",
      employeeId: empActive2.id,
      pensionSchemeId: scheme.id,
      retirementCategory: "VOLUNTARY",
      expectedRetirementDate: d("2027-02-15"),
      currentStage: "DOCUMENT_SUBMISSION" as RetirementStage,
      status: "OPEN",
      assignedOfficerId: recordsUser.id,
      createdById: recordsUser.id,
    },
  });

  if (!(await prisma.retirementTimeline.findFirst({ where: { retirementCaseId: caseOpen.id, action: "CASE_CREATED" } }))) {
    await prisma.retirementTimeline.createMany({
      data: [
        { retirementCaseId: caseOpen.id, stage: "ELIGIBILITY_ASSESSMENT", action: "CASE_CREATED", performedById: hrUser.id, comments: "Case opened from HR request" },
        { retirementCaseId: caseOpen.id, stage: "DOCUMENT_SUBMISSION", action: "DOCUMENTS_REQUESTED", performedById: recordsUser.id, comments: "Checklist issued" },
        { retirementCaseId: caseOpen.id, stage: "CASE_REVIEW", action: "MOVED_TO_REVIEW", performedById: recordsUser.id, comments: "File complete for review" },
      ],
    });
  }

  for (const [dtype, fname] of [
    ["APPOINTMENT_LETTER", "hassan-appointment.pdf"],
    ["PROMOTION_LETTER", "hassan-promotion.pdf"],
    ["PASSPORT_PHOTO", "hassan-photo.jpg"],
  ] as const) {
    if (!(await prisma.retirementDocument.findFirst({ where: { retirementCaseId: caseOpen.id, documentType: dtype } }))) {
      await prisma.retirementDocument.create({
        data: {
          retirementCaseId: caseOpen.id,
          documentType: dtype,
          fileName: fname,
          filePath: `seed/retirement/${fname}`,
          status: "SUBMITTED",
        },
      });
    }
  }
  console.log("✓ Retirement cases (3) + timeline/docs");

  await prisma.benefitAssessment.upsert({
    where: { assessmentRef: "BA-2024-0088" },
    update: {},
    create: {
      retirementCaseId: caseEnrolled.id,
      ruleVersionId: factorRules.id,
      assessmentRef: "BA-2024-0088",
      status: "APPROVED",
      qualifyingServiceYears: 39.83,
      finalSalary: 280000,
      calculationInputs: { method: "FACTOR", monthlyPensionFactor: 0.5 },
      calculationBreakdown: { monthlyPension: 140000, gratuity: 11152400, note: "Demo DEMO-FACTOR-v1" },
      grossEntitlement: 140000,
      deductions: 0,
      netEntitlement: 140000,
      gratuityAmount: 11152400,
      monthlyPension: 140000,
      assessedById: benefitUser.id,
      reviewedById: reviewUser.id,
      approvedById: approveUser.id,
      assessedAt: d("2024-11-10"),
      reviewedAt: d("2024-11-15"),
      approvedAt: d("2024-11-20"),
    },
  });

  await prisma.benefitAssessment.upsert({
    where: { assessmentRef: "BA-2026-0001" },
    update: {},
    create: {
      retirementCaseId: caseOpen.id,
      ruleVersionId: factorRules.id,
      assessmentRef: "BA-2026-0001",
      status: "DRAFT",
      qualifyingServiceYears: 36.5,
      finalSalary: 320000,
      assessedById: benefitUser.id,
    },
  });
  console.log("✓ Benefit assessments");

  const pensioner = await prisma.pensioner.upsert({
    where: { pensionerNumber: "PEN/KG/2025/0001" },
    update: { userId: pensionerPortalUser.id, paymentStatus: "ACTIVE", verificationStatus: "VERIFIED" },
    create: {
      pensionerNumber: "PEN/KG/2025/0001",
      employeeId: empRetired.id,
      userId: pensionerPortalUser.id,
      organizationId: moe.id,
      pensionSchemeId: scheme.id,
      retirementCaseId: caseEnrolled.id,
      retirementDate: d("2024-12-31"),
      enrolmentDate: d("2025-01-15"),
      entitlementAmount: 140000,
      monthlyPension: 140000,
      paymentFrequency: "MONTHLY",
      paymentStatus: "ACTIVE",
      verificationStatus: "VERIFIED",
      bankName: "First Bank of Nigeria",
      bankAccountNumber: "3012345678",
      bankAccountName: "JOSEPH K ADAMU",
      bvn: "22123456789",
      isActive: true,
    },
  });
  console.log("✓ Pensioner PEN/KG/2025/0001");

  if (!(await prisma.verificationCase.findFirst({ where: { reference: "VER-2025-0001" } }))) {
    await prisma.verificationCase.create({
      data: {
        reference: "VER-2025-0001",
        pensionerId: pensioner.id,
        employeeId: empRetired.id,
        verificationType: "ANNUAL",
        status: "APPROVED",
        scheduledDate: d("2025-06-01"),
        completedDate: d("2025-06-05"),
        decision: "APPROVED",
        decisionReason: "Identity and life confirmation successful",
        decidedById: verifyUser.id,
        decidedAt: d("2025-06-05"),
        assignedOfficerId: verifyUser.id,
      },
    });
  }
  if (!(await prisma.verificationCase.findFirst({ where: { reference: "VER-2026-0010" } }))) {
    await prisma.verificationCase.create({
      data: {
        reference: "VER-2026-0010",
        pensionerId: pensioner.id,
        employeeId: empRetired.id,
        verificationType: "ANNUAL",
        status: "PENDING",
        scheduledDate: d("2026-06-01"),
      },
    });
  }
  console.log("✓ Verification cases");

  const schedule = await prisma.paymentSchedule.upsert({
    where: { scheduleRef: "PAY-2026-03" },
    update: {},
    create: {
      scheduleRef: "PAY-2026-03",
      paymentPeriod: "2026-03",
      periodStart: d("2026-03-01"),
      periodEnd: d("2026-03-31"),
      status: "AUTHORIZED",
      totalAmount: 140000,
      totalItems: 1,
      preparedById: financeUser.id,
      authorizedById: payAuthUser.id,
      preparedAt: d("2026-03-05"),
      authorizedAt: d("2026-03-08"),
      notes: "March 2026 demo payroll",
    },
  });
  if (!(await prisma.paymentScheduleItem.findFirst({ where: { scheduleId: schedule.id, pensionerId: pensioner.id } }))) {
    await prisma.paymentScheduleItem.create({
      data: {
        scheduleId: schedule.id,
        pensionerId: pensioner.id,
        amount: 140000,
        adjustments: 0,
        deductions: 0,
        netAmount: 140000,
        bankAccountNumber: "3012345678",
        bankName: "First Bank of Nigeria",
        status: "PAID",
        transactionRef: "FBN-TRX-202603-0001",
      },
    });
  }

  const scheduleDraft = await prisma.paymentSchedule.upsert({
    where: { scheduleRef: "PAY-2026-04" },
    update: {},
    create: {
      scheduleRef: "PAY-2026-04",
      paymentPeriod: "2026-04",
      periodStart: d("2026-04-01"),
      periodEnd: d("2026-04-30"),
      status: "DRAFT",
      totalAmount: 140000,
      totalItems: 1,
      preparedById: financeUser.id,
      preparedAt: d("2026-04-02"),
      notes: "April 2026 draft schedule",
    },
  });
  if (!(await prisma.paymentScheduleItem.findFirst({ where: { scheduleId: scheduleDraft.id, pensionerId: pensioner.id } }))) {
    await prisma.paymentScheduleItem.create({
      data: {
        scheduleId: scheduleDraft.id,
        pensionerId: pensioner.id,
        amount: 140000,
        netAmount: 140000,
        bankAccountNumber: "3012345678",
        bankName: "First Bank of Nigeria",
        status: "PENDING",
      },
    });
  }
  console.log("✓ Payment schedules");

  if (!(await prisma.arrear.findFirst({ where: { pensionerId: pensioner.id, periodFrom: "2025-01" } }))) {
    await prisma.arrear.create({
      data: {
        reference: "ARR-2025-0001",
        pensionerId: pensioner.id,
        periodFrom: "2025-01",
        periodTo: "2025-02",
        monthsCount: 2,
        monthlyAmount: 140000,
        totalAmount: 280000,
        reason: "Enrolment lag — Jan/Feb 2025",
        status: "APPROVED",
        approvedById: approveUser.id,
        approvedAt: d("2025-03-10"),
        createdById: financeUser.id,
        notes: "Demo approved arrear",
      },
    });
  }
  if (!(await prisma.arrear.findFirst({ where: { pensionerId: pensioner.id, status: "OPEN" } }))) {
    await prisma.arrear.create({
      data: {
        reference: "ARR-2025-0012",
        pensionerId: pensioner.id,
        periodFrom: "2025-12",
        periodTo: "2025-12",
        monthsCount: 1,
        monthlyAmount: 140000,
        totalAmount: 140000,
        reason: "Missed December cycle",
        status: "OPEN",
        createdById: financeUser.id,
      },
    });
  }
  console.log("✓ Arrears");

  if (!(await prisma.paymentReconciliation.findFirst({ where: { reference: "REC-2026-03" } }))) {
    await prisma.paymentReconciliation.create({
      data: {
        reference: "REC-2026-03",
        scheduleId: schedule.id,
        bankReference: "FBN-BATCH-202603",
        bankDate: d("2026-03-10"),
        expectedAmount: 140000,
        actualAmount: 140000,
        variance: 0,
        matchedItems: 1,
        unmatchedItems: 0,
        status: "MATCHED",
        notes: "Demo full match",
        reconciledById: financeUser.id,
        reconciledAt: d("2026-03-12"),
      },
    });
  }
  console.log("✓ Reconciliation");

  if (!(await prisma.complaint.findFirst({ where: { reference: "CMP-2026-0003" } }))) {
    await prisma.complaint.create({
      data: {
        reference: "CMP-2026-0003",
        pensionerId: pensioner.id,
        submitterName: "Joseph Adamu",
        submitterEmail: "pensioner.demo@kscspms.kg.gov.ng",
        submitterPhone: "+234-801-111-0004",
        category: "PAYMENT",
        subject: "Query on March payment value date",
        description: "I received March pension but the value date on my statement differs from the portal.",
        priority: "MEDIUM",
        status: "OPEN",
      },
    });
  }
  if (!(await prisma.complaint.findFirst({ where: { reference: "CMP-2025-0041" } }))) {
    await prisma.complaint.create({
      data: {
        reference: "CMP-2025-0041",
        pensionerId: pensioner.id,
        submitterName: "Joseph Adamu",
        category: "VERIFICATION",
        subject: "Verification centre location",
        description: "Please confirm the Lokoja verification centre address.",
        priority: "LOW",
        status: "RESOLVED",
        assignedOfficerId: supportUser.id,
        resolution: "Address confirmed: Pension House, Lokoja.",
        closedAt: d("2025-07-20"),
      },
    });
  }
  console.log("✓ Complaints");

  if (!(await prisma.notification.findFirst({ where: { userId: pensionerPortalUser.id, title: "Welcome to the pensioner portal" } }))) {
    await prisma.notification.createMany({
      data: [
        { userId: pensionerPortalUser.id, title: "Welcome to the pensioner portal", message: "Your account is linked to PEN/KG/2025/0001.", type: "INFO", link: "/portal", isRead: false },
        { userId: pensionerPortalUser.id, title: "March 2026 payment authorized", message: "Schedule PAY-2026-03 authorized. Net ₦140,000.", type: "SUCCESS", link: "/portal/payments", isRead: false },
        { userId: financeUser.id, title: "Draft schedule awaiting review", message: "PAY-2026-04 is in DRAFT.", type: "INFO", link: "/admin/payments", isRead: false },
        { userId: recordsUser.id, title: "Retirement case assigned", message: "RC-2026-0001 is in CASE_REVIEW.", type: "INFO", link: "/admin/retirements", isRead: false },
      ],
    });
  }
  console.log("✓ Notifications");

  await prisma.announcement.upsert({
    where: { slug: "welcome-to-kscspms" },
    update: {},
    create: {
      title: "Welcome to the Kogi State Civil Service Pension Management System",
      slug: "welcome-to-kscspms",
      content: "The KSCSPMS platform is now online for civil service pension administration.",
      excerpt: "Official launch.",
      isPublished: true,
      publishedAt: d("2026-01-15"),
    },
  });
  await prisma.announcement.upsert({
    where: { slug: "verification-exercise-2026" },
    update: {},
    create: {
      title: "2026 Annual Verification Exercise",
      slug: "verification-exercise-2026",
      content: "All active pensioners must complete annual verification via portal or designated centres.",
      excerpt: "Annual verification 2026.",
      isPublished: true,
      publishedAt: d("2026-02-01"),
    },
  });
  await prisma.announcement.upsert({
    where: { slug: "portal-self-service" },
    update: {},
    create: {
      title: "Portal self-service features",
      slug: "portal-self-service",
      content: "Payment history, verification booking, and complaints tracking are available.",
      excerpt: "Self-service live.",
      isPublished: true,
      publishedAt: d("2026-03-01"),
    },
  });
  console.log("✓ Announcements");

  for (const s of [
    { key: "app.name", value: "KSCSPMS" },
    { key: "app.maintenance_mode", value: false },
    { key: "payments.default_currency", value: "NGN" },
    { key: "verification.annual_window_months", value: 6 },
    { key: "uploads.max_mb", value: 10 },
  ]) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.log("✓ System settings");

  if (!(await prisma.auditLog.findFirst({ where: { action: "SEED.COMPLETED" } }))) {
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: "SEED.COMPLETED",
        entityType: "System",
        afterValues: { message: "Full demo seed applied", pensioner: "PEN/KG/2025/0001" },
        outcome: "SUCCESS",
      },
    });
  }
  console.log("✓ Audit log sample");

  console.log("\n══════════════════════════════════════════════════");
  console.log(" Full demo seed completed");
  console.log("══════════════════════════════════════════════════");
  console.log("\nAll passwords: ChangeMe@2026!");
  console.log("  admin@kscspms.kg.gov.ng          SUPER_ADMIN");
  console.log("  hr@kscspms.kg.gov.ng             HR_OFFICER");
  console.log("  records@kscspms.kg.gov.ng        MDA_RECORDS");
  console.log("  verify@kscspms.kg.gov.ng         VERIFICATION");
  console.log("  benefits@kscspms.kg.gov.ng       BENEFIT_CALC");
  console.log("  review@kscspms.kg.gov.ng         BENEFIT_REVIEWER");
  console.log("  approve@kscspms.kg.gov.ng        APPROVAL_OFFICER");
  console.log("  finance@kscspms.kg.gov.ng        FINANCE_OFFICER");
  console.log("  payauth@kscspms.kg.gov.ng        PAYMENT_AUTHORIZER");
  console.log("  support@kscspms.kg.gov.ng        CUSTOMER_SUPPORT");
  console.log("  pensioner.demo@kscspms.kg.gov.ng PENSIONER portal");
  console.log("\nChange default passwords after first login.");
  console.log("DEMO-FACTOR rules are for testing only.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
