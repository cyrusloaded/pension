/**
 * Minimal seed: permissions, roles, grants, orgs (for FK), and login users only.
 * No pensioners, schedules, or demo business data.
 *
 * Run: npx tsx prisma/seed-users-only.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_CODES } from "../src/lib/permissions/constants";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding users only (no demo pension data)...\n");

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
    { code: ROLE_CODES.SYSTEM_ADMIN, name: "System Administrator", isSystem: true },
    { code: ROLE_CODES.PENSION_ADMIN, name: "Pension Administrator", isSystem: true },
    { code: ROLE_CODES.HR_OFFICER, name: "HR Officer", isSystem: true },
    { code: ROLE_CODES.MDA_RECORDS, name: "MDA Records Officer", isSystem: true },
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
      update: { name: r.name },
      create: r,
    });
  }

  async function roleByCode(code: string) {
    const role = await prisma.role.findUnique({ where: { code } });
    if (!role) throw new Error(`Role missing: ${code}`);
    return role;
  }

  async function grant(roleCode: string, permCodes: string[]) {
    const role = await roleByCode(roleCode);
    for (const code of permCodes) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  const allPerms = Object.values(PERMISSIONS);
  const superAdmin = await roleByCode(ROLE_CODES.SUPER_ADMIN);
  for (const code of allPerms) {
    const perm = await prisma.permission.findUnique({ where: { code } });
    if (!perm) continue;
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: superAdmin.id, permissionId: perm.id },
    });
  }

  await grant(ROLE_CODES.HR_OFFICER, [
    "employees.read", "employees.create", "employees.update",
    "retirements.read", "retirements.create",
  ]);
  await grant(ROLE_CODES.MDA_RECORDS, [
    "employees.read", "employees.create", "employees.update",
    "retirements.read", "retirements.create", "retirements.review",
  ]);
  await grant(ROLE_CODES.VERIFICATION_OFFICER, [
    "verification.read", "verification.manage", "pensioners.read", "employees.read",
  ]);
  await grant(ROLE_CODES.BENEFIT_CALC, [
    "benefits.calculate", "retirements.read", "retirements.review", "employees.read",
  ]);
  await grant(ROLE_CODES.BENEFIT_REVIEWER, [
    "benefits.review", "retirements.read", "employees.read",
  ]);
  await grant(ROLE_CODES.APPROVAL_OFFICER, [
    "benefits.approve", "retirements.read", "retirements.review",
  ]);
  await grant(ROLE_CODES.FINANCE_OFFICER, [
    "payments.prepare", "payments.read", "pensioners.read", "reports.view",
  ]);
  await grant(ROLE_CODES.PAYMENT_AUTHORIZER, [
    "payments.authorize", "payments.read", "reports.view", "schedule.dfa_pay",
  ]);
  await grant(ROLE_CODES.RECONCILIATION_OFFICER, [
    "payments.reconcile", "payments.read",
  ]);
  await grant(ROLE_CODES.CUSTOMER_SUPPORT, [
    "complaints.read", "complaints.manage", "pensioners.read",
  ]);
  await grant(ROLE_CODES.PENSION_ADMIN, [
    "employees.read", "pensioners.read", "pensioners.create", "pensioners.update",
    "placements.read", "placements.manage", "retirements.read", "reports.view",
  ]);
  await grant(ROLE_CODES.INTERNAL_AUDITOR, [
    "schedule.audit", "audit.read", "payments.read", "pensioners.read",
    "employees.read", "gratuity.read", "reports.view", "reports.export",
  ]);
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

  // Minimal orgs (required FK for users)
  const mof = await prisma.organization.upsert({
    where: { code: "KG-MOF" },
    update: {},
    create: {
      name: "Ministry of Finance",
      code: "KG-MOF",
      type: "MINISTRY",
      status: "ACTIVE",
    },
  });
  const penBoard = await prisma.organization.upsert({
    where: { code: "KG-PEN" },
    update: {},
    create: {
      name: "Kogi State Pension Board",
      code: "KG-PEN",
      type: "AGENCY",
      status: "ACTIVE",
      parentId: mof.id,
    },
  });
  const moe = await prisma.organization.upsert({
    where: { code: "KG-MOE" },
    update: {},
    create: {
      name: "Ministry of Education",
      code: "KG-MOE",
      type: "MINISTRY",
      status: "ACTIVE",
    },
  });
  const moh = await prisma.organization.upsert({
    where: { code: "KG-MOH" },
    update: {},
    create: {
      name: "Ministry of Health",
      code: "KG-MOH",
      type: "MINISTRY",
      status: "ACTIVE",
    },
  });

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
      update: {
        passwordHash: pwd,
        isActive: true,
      },
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

  const users = [
    {
      email: "admin@kscspms.kg.gov.ng",
      username: "superadmin",
      staffNumber: "KG-ADMIN-001",
      firstName: "System",
      lastName: "Administrator",
      organizationId: mof.id,
      roleCode: ROLE_CODES.SUPER_ADMIN,
    },
    {
      email: "records@kscspms.kg.gov.ng",
      username: "records",
      staffNumber: "KG-REC-001",
      firstName: "Chinedu",
      lastName: "Okafor",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.PENSION_RECORDS,
    },
    {
      email: "schedule@kscspms.kg.gov.ng",
      username: "schedule",
      staffNumber: "KG-SCH-001",
      firstName: "Amina",
      lastName: "Yusuf",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.SCHEDULE_PREP,
    },
    {
      email: "auditor@kscspms.kg.gov.ng",
      username: "auditor",
      staffNumber: "KG-AUD-001",
      firstName: "Fatima",
      lastName: "Bello",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.INTERNAL_AUDITOR,
    },
    {
      email: "dg@kscspms.kg.gov.ng",
      username: "dg",
      staffNumber: "KG-DG-001",
      firstName: "Musa",
      lastName: "Abdullahi",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.DIRECTOR_GENERAL,
    },
    {
      email: "dfa@kscspms.kg.gov.ng",
      username: "dfa",
      staffNumber: "KG-DFA-001",
      firstName: "Ngozi",
      lastName: "Eze",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.DFA,
    },
    {
      email: "verify@kscspms.kg.gov.ng",
      username: "verifier",
      staffNumber: "KG-VER-001",
      firstName: "Ibrahim",
      lastName: "Sule",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.VERIFICATION_OFFICER,
    },
    {
      email: "support@kscspms.kg.gov.ng",
      username: "support",
      staffNumber: "KG-CS-001",
      firstName: "Blessing",
      lastName: "Okoro",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.CUSTOMER_SUPPORT,
    },
    {
      email: "finance@kscspms.kg.gov.ng",
      username: "finance",
      staffNumber: "KG-FIN-001",
      firstName: "Tunde",
      lastName: "Balogun",
      organizationId: penBoard.id,
      roleCode: ROLE_CODES.FINANCE_OFFICER,
    },
    {
      email: "hr@kscspms.kg.gov.ng",
      username: "hrofficer",
      staffNumber: "KG-HR-001",
      firstName: "Grace",
      lastName: "Adewale",
      organizationId: moe.id,
      roleCode: ROLE_CODES.HR_OFFICER,
    },
  ];

  for (const u of users) {
    await ensureUser(u);
    console.log(`✓ ${u.email}  (${u.username})  → ${u.roleCode}`);
  }

  console.log("\n========================================");
  console.log("ALL PASSWORDS:  ChangeMe@2026!");
  console.log("========================================");
  console.log("Email                              Username      Role");
  console.log("admin@kscspms.kg.gov.ng             superadmin    SUPER_ADMIN");
  console.log("records@kscspms.kg.gov.ng           records       PENSION_RECORDS");
  console.log("schedule@kscspms.kg.gov.ng          schedule      SCHEDULE_PREP");
  console.log("auditor@kscspms.kg.gov.ng           auditor       INTERNAL_AUDITOR");
  console.log("dg@kscspms.kg.gov.ng                dg            DIRECTOR_GENERAL");
  console.log("dfa@kscspms.kg.gov.ng               dfa           DFA");
  console.log("verify@kscspms.kg.gov.ng            verifier      VERIFICATION");
  console.log("support@kscspms.kg.gov.ng           support       CUSTOMER_SUPPORT");
  console.log("finance@kscspms.kg.gov.ng           finance       FINANCE_OFFICER");
  console.log("hr@kscspms.kg.gov.ng                hrofficer     HR_OFFICER");
  console.log("\nLogin with email + password (or username if your login form supports it).");
  console.log("Change passwords after first login.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
