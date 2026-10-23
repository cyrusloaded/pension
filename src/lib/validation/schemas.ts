import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().min(2, "Name is required").max(200),
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, or hyphens"),
  type: z.enum([
    "MINISTRY",
    "DEPARTMENT",
    "AGENCY",
    "LGA",
    "ADMIN_OFFICE",
    "UNIT",
    "SECTION",
  ]),
  parentId: z.string().cuid().optional().nullable(),
  lgaCode: z.string().max(50).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
});

export const employeeCreateSchema = z.object({
  staffNumber: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9\-\/]+$/, "Invalid staff number format"),
  title: z.string().max(20).optional().nullable(),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  middleName: z.string().max(100).optional().nullable(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  maritalStatus: z.string().max(30).optional().nullable(),
  nationality: z.string().max(50).optional().nullable(),
  stateOfOrigin: z.string().max(50).optional().nullable(),
  lgaOfOrigin: z.string().max(50).optional().nullable(),
  nin: z
    .string()
    .regex(/^\d{11}$/, "NIN must be 11 digits")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  residentialAddress: z.string().max(500).optional().nullable(),
  permanentAddress: z.string().max(500).optional().nullable(),
  organizationId: z.string().min(1, "Organization is required"),
  employmentCategory: z.string().max(50).optional().nullable(),
  appointmentDate: z.string().optional().nullable(),
  confirmationDate: z.string().optional().nullable(),
  jobTitle: z.string().max(150).optional().nullable(),
  gradeLevel: z.string().max(20).optional().nullable(),
  step: z.coerce.number().int().min(0).max(20).optional().nullable(),
  employmentStatus: z
    .enum([
      "ACTIVE",
      "ON_LEAVE",
      "SUSPENDED",
      "RETIRED",
      "TERMINATED",
      "DECEASED",
      "ARCHIVED",
    ])
    .default("ACTIVE"),
  pensionSchemeId: z.string().optional().nullable(),
  nextOfKinName: z.string().max(150).optional().nullable(),
  nextOfKinPhone: z.string().max(30).optional().nullable(),
  nextOfKinRelationship: z.string().max(50).optional().nullable(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial().extend({
  staffNumber: employeeCreateSchema.shape.staffNumber.optional(),
});

export const serviceHistorySchema = z.object({
  organizationId: z.string().optional().nullable(),
  jobTitle: z.string().max(150).optional().nullable(),
  gradeLevel: z.string().max(20).optional().nullable(),
  step: z.coerce.number().int().min(0).max(20).optional().nullable(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  reason: z.string().max(200).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
  isCurrent: z.boolean().default(false),
});

export const salaryHistorySchema = z.object({
  gradeLevel: z.string().min(1).max(20),
  step: z.coerce.number().int().min(0).max(20).optional().nullable(),
  basicSalary: z.coerce.number().positive("Basic salary must be positive"),
  allowances: z.coerce.number().min(0).optional().nullable(),
  totalEmolument: z.coerce.number().min(0).optional().nullable(),
  effectiveDate: z.string().min(1, "Effective date is required"),
  endDate: z.string().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

export const pensionerCreateSchema = z.object({
  pensionerNumber: z.string().min(2).max(50).optional(),
  employeeId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  pensionSchemeId: z.string().optional().nullable(),
  retirementCaseId: z.string().optional().nullable(),
  retirementDate: z.string().optional().nullable(),
  enrolmentDate: z.string().optional().nullable(),
  entitlementAmount: z.coerce.number().min(0).optional().nullable(),
  monthlyPension: z.coerce.number().min(0).optional().nullable(),
  paymentFrequency: z.enum(["MONTHLY", "QUARTERLY"]).default("MONTHLY"),
  paymentStatus: z
    .enum(["PENDING", "ACTIVE", "SUSPENDED", "STOPPED"])
    .default("PENDING"),
  verificationStatus: z
    .enum(["PENDING", "VERIFIED", "FAILED", "EXPIRED"])
    .default("PENDING"),
  bankName: z.string().max(100).optional().nullable(),
  bankAccountNumber: z.string().max(20).optional().nullable(),
  bankAccountName: z.string().max(150).optional().nullable(),
  bvn: z
    .string()
    .regex(/^\d{11}$/, "BVN must be 11 digits")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const userCreateSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).optional().nullable(),
  staffNumber: z.string().max(50).optional().nullable(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain a number"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  organizationId: z.string().optional().nullable(),
  roleIds: z.array(z.string()).min(1, "At least one role is required"),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional().nullable(),
  staffNumber: z.string().max(50).optional().nullable(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  middleName: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  organizationId: z.string().optional().nullable(),
  roleIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .optional(),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type PensionerCreateInput = z.infer<typeof pensionerCreateSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const retirementCreateSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  pensionSchemeId: z.string().optional().nullable(),
  retirementCategory: z.string().max(50).optional().nullable(),
  expectedRetirementDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  assignedOfficerId: z.string().optional().nullable(),
});

export const retirementTransitionSchema = z.object({
  toStage: z.string().min(1),
  comments: z.string().max(2000).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export const retirementDocumentSchema = z.object({
  documentType: z.string().min(1),
  fileName: z.string().min(1).max(255),
  filePath: z.string().min(1).max(500),
  remarks: z.string().max(500).optional().nullable(),
});

export const verificationCreateSchema = z.object({
  employeeId: z.string().optional().nullable(),
  pensionerId: z.string().optional().nullable(),
  verificationType: z.enum([
    "IN_PERSON",
    "DOCUMENT_REVIEW",
    "DIGITAL",
    "FIELD",
    "ANNUAL",
    "OTHER",
  ]),
  scheduledDate: z.string().optional().nullable(),
  assignedOfficerId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const verificationDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "MORE_INFO"]),
  decisionReason: z.string().max(1000).optional().nullable(),
});

export type RetirementCreateInput = z.infer<typeof retirementCreateSchema>;
export type VerificationCreateInput = z.infer<typeof verificationCreateSchema>;

export const benefitAssessmentCreateSchema = z.object({
  retirementCaseId: z.string().min(1),
  ruleVersionId: z.string().optional().nullable(),
  qualifyingServiceYears: z.coerce.number().min(0).max(60).optional().nullable(),
  finalSalary: z.coerce.number().min(0).optional().nullable(),
});

export const benefitCalculateSchema = z.object({
  qualifyingServiceYears: z.coerce.number().min(0).max(60),
  finalSalary: z.coerce.number().positive("Final salary must be positive"),
  ruleVersionId: z.string().optional().nullable(),
});

export const benefitDecisionSchema = z.object({
  action: z.enum(["SUBMIT", "RETURN", "APPROVE", "REJECT"]),
  comments: z.string().max(2000).optional().nullable(),
});

export const pensionRuleCreateSchema = z.object({
  schemeId: z.string().min(1),
  version: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
  rulesJson: z.record(z.unknown()),
});

export const pensionRuleApproveSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "SUPERSEDE"]),
  comments: z.string().max(500).optional().nullable(),
});

export const paymentScheduleCreateSchema = z.object({
  paymentPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM"),
  notes: z.string().max(1000).optional().nullable(),
});

export const paymentTransitionSchema = z.object({
  toStatus: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
});

export const arrearCreateSchema = z.object({
  pensionerId: z.string().min(1),
  periodFrom: z.string().min(1),
  periodTo: z.string().min(1),
  monthsCount: z.coerce.number().int().min(1).max(120),
  monthlyAmount: z.coerce.number().positive(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const arrearDecisionSchema = z.object({
  action: z.enum(["APPROVE", "CANCEL", "WRITE_OFF", "MARK_PAID"]),
  notes: z.string().max(500).optional().nullable(),
});

export const reconciliationCreateSchema = z.object({
  scheduleId: z.string().min(1),
  bankReference: z.string().max(100).optional().nullable(),
  bankDate: z.string().optional().nullable(),
  actualAmount: z.coerce.number().min(0).optional().nullable(),
  matchedItems: z.coerce.number().int().min(0).optional().nullable(),
  unmatchedItems: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const pensionerPaymentStatusSchema = z.object({
  paymentStatus: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "STOPPED"]),
  reason: z.string().min(3).max(500),
});
