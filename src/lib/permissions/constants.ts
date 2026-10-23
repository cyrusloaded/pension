export const PERMISSIONS = {
  // Employees
  EMPLOYEES_READ: "employees.read",
  EMPLOYEES_CREATE: "employees.create",
  EMPLOYEES_UPDATE: "employees.update",
  EMPLOYEES_ARCHIVE: "employees.archive",

  // Pensioners
  PENSIONERS_READ: "pensioners.read",
  PENSIONERS_CREATE: "pensioners.create",
  PENSIONERS_UPDATE: "pensioners.update",

  // Retirements
  RETIREMENTS_CREATE: "retirements.create",
  RETIREMENTS_REVIEW: "retirements.review",
  RETIREMENTS_READ: "retirements.read",

  // Benefits
  BENEFITS_CALCULATE: "benefits.calculate",
  BENEFITS_REVIEW: "benefits.review",
  BENEFITS_APPROVE: "benefits.approve",

  // Payments
  PAYMENTS_PREPARE: "payments.prepare",
  PAYMENTS_AUTHORIZE: "payments.authorize",
  PAYMENTS_RECONCILE: "payments.reconcile",
  PAYMENTS_READ: "payments.read",

  // Verification
  VERIFICATION_MANAGE: "verification.manage",
  VERIFICATION_READ: "verification.read",

  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",

  // Users & Admin
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  AUDIT_READ: "audit.read",
  SETTINGS_MANAGE: "settings.manage",
  ORGANIZATIONS_MANAGE: "organizations.manage",

  // Complaints
  COMPLAINTS_MANAGE: "complaints.manage",
  COMPLAINTS_READ: "complaints.read",

  // SRS — placements, gratuity ledger, gov workflow
  PLACEMENTS_READ: "placements.read",
  PLACEMENTS_MANAGE: "placements.manage",
  GRATUITY_READ: "gratuity.read",
  GRATUITY_MANAGE: "gratuity.manage",
  SCHEDULE_AUDIT: "schedule.audit",
  SCHEDULE_DG_APPROVE: "schedule.dg_approve",
  SCHEDULE_DFA_PAY: "schedule.dfa_pay",
  NOK_CLAIMS_MANAGE: "nok.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  PENSION_DIRECTOR: "PENSION_DIRECTOR",
  PENSION_ADMIN: "PENSION_ADMIN",
  HR_OFFICER: "HR_OFFICER",
  MDA_RECORDS: "MDA_RECORDS",
  LGA_RECORDS: "LGA_RECORDS",
  VERIFICATION_OFFICER: "VERIFICATION_OFFICER",
  BENEFIT_CALC: "BENEFIT_CALC",
  BENEFIT_REVIEWER: "BENEFIT_REVIEWER",
  APPROVAL_OFFICER: "APPROVAL_OFFICER",
  FINANCE_OFFICER: "FINANCE_OFFICER",
  PAYMENT_AUTHORIZER: "PAYMENT_AUTHORIZER",
  RECONCILIATION_OFFICER: "RECONCILIATION_OFFICER",
  INTERNAL_AUDITOR: "INTERNAL_AUDITOR",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  READ_ONLY: "READ_ONLY",
  PENSIONER: "PENSIONER",
  // SRS-aligned government roles
  PENSION_RECORDS: "PENSION_RECORDS",
  SCHEDULE_PREP: "SCHEDULE_PREP",
  DIRECTOR_GENERAL: "DIRECTOR_GENERAL",
  DFA: "DFA",
  CASHIER: "CASHIER",
} as const;
