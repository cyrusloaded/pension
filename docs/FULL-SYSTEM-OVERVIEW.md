# KSCSPMS — Full Redeveloped System Overview

**Kogi State Civil Service Pension Management System**  
Aligned with the Civil Service Pension SRS (placements, gratuity ledger, four-stage approvals, RBAC, portal).

---

## 1. What the system is

A full-stack **Next.js 15 + PostgreSQL + Prisma** platform that:

1. Registers civil servants and pensioners  
2. Tracks **new placements** until payroll activation  
3. Runs **retirement → benefit assessment → enrolment**  
4. Manages **monthly pension** and **gratuity** separately  
5. Runs payment lists through **Prepare → Internal Audit → DG → DFA**  
6. Supports **Excel import**, bank/gateway payment assessments  
7. Gives **pensioners a self-service portal**  
8. Enforces **roles/permissions** and **audit logs**

---

## 2. Architecture

```
Browser (Public | Admin | Portal)
        │
        ▼
Next.js App Router (React Server Components + Route Handlers)
        │
   ┌────┴────┬──────────────┬─────────────┐
   │ Auth/   │ Domain libs  │ Storage     │
   │ RBAC    │ workflows,   │ local/S3    │
   │         │ BR rules,    │             │
   │         │ calculations │             │
   └────┬────┴──────┬───────┴──────┬──────┘
        │           │              │
        ▼           ▼              ▼
   PostgreSQL   AuditLog      ./uploads or MinIO
```

**Stack:** TypeScript, Tailwind, Zod, bcrypt sessions, Prisma, Docker Postgres.

---

## 3. Data model (38 entities)

| Domain | Models |
|--------|--------|
| Identity | User, Role, Permission, UserRole, RolePermission, Session, LoginHistory |
| Org structure | Organization |
| Workforce | Employee, ServiceHistory, SalaryHistory, EmployeeDocument |
| Scheme rules | PensionScheme, PensionRuleVersion |
| Retirement | RetirementCase, RetirementDocument, RetirementTimeline, BenefitAssessment |
| Pensioner | Pensioner, PlacementRecord |
| Gratuity | GratuityEntitlement, GratuityInstallment, NextOfKinClaim |
| Verification | VerificationCase, VerificationEvidence |
| Payments | PaymentSchedule, PaymentScheduleItem, PaymentAssessment, PaymentGatewayTransaction, Arrear, PaymentReconciliation |
| Hybrid | PhysicalFileDispatch |
| Ops | Complaint, Notification, AuditLog, SystemSetting, Announcement |

---

## 4. Admin modules (URLs)

| Module | Path | Purpose |
|--------|------|---------|
| Dashboard | `/admin/dashboard` | SRS KPIs: placements, outstanding gratuity, Audit/DG/DFA queues |
| Organizations | `/admin/organizations` | MDAs / LGAs |
| Users / Roles | `/admin/users`, `/admin/roles` | Accounts & permissions |
| Employees | `/admin/employees` | Registry, import, service/salary history |
| Pensioners | `/admin/pensioners` | Payees, bank, status |
| **New placements** | `/admin/placements` | Awaiting payroll + historical placements |
| Retirements | `/admin/retirements` | Case stages & documents |
| Benefits / Approvals | `/admin/benefits`, `/admin/approvals` | Calculate / review / approve awards |
| **Gratuity** | `/admin/gratuity` | Entitlement ledger & outstanding balances |
| Verification | `/admin/verification` | Life/identity checks |
| Payment schedules | `/admin/payment-schedules` | Prepare / list |
| Import schedule | `/admin/payment-schedules/import` | Excel/CSV + **download template** |
| Review lines | `/admin/payment-schedules/[id]/review` | Edit / Save / Delete rows; Process / Delete |
| Process | `/admin/payment-schedules/[id]/process` | Generate payment assessment |
| Schedule detail | `/admin/payment-schedules/[id]` | **Gov workflow panel** (4 stages) |
| Payment assessment | `/admin/payment-assessments/[id]` | Pay bank or gateway |
| Arrears / Recon | `/admin/arrears`, `/admin/reconciliation` | Back-pay & bank match |
| Complaints | `/admin/complaints` | Service desk |
| Reports / Audit | `/admin/reports`, `/admin/audit-logs` | Oversight |
| Settings | `/admin/settings` | Ops checklist |

---

## 5. Pensioner portal

| Path | Function |
|------|----------|
| `/portal/dashboard` | Summary |
| `/portal/payments` | History + CSV |
| `/portal/documents` | Downloads |
| `/portal/verification` | Status |
| `/portal/profile` | Details |
| `/portal/complaints` | File tickets |
| `/portal/notifications` | Alerts |

---

## 6. Government payment workflow (SRS)

```
PREPARATION → INTERNAL_AUDIT → DG_APPROVAL → DFA_PAYMENT → COMPLETED
                 │                  │
                 └── Return/Reject ─┘
```

- Enforced in `/api/payments/[id]/workflow`  
- UI: `GovWorkflowPanel` on schedule detail  
- **Separation of duties:** preparer cannot audit or DG-approve the same schedule  
- Legacy status (`DRAFT`, `APPROVED`, …) is mirrored from workflow stage  

---

## 7. Monthly schedule path (import)

```
Download template → Fill Excel/CSV → Upload
    → Review (edit/save/delete rows)
    → Process → Generate assessment
    → Pay (bank or gateway) → System shows PAID
```

Template: `/templates/payment-schedule-import-template.xlsx`

---

## 8. Gratuity rules

```
Outstanding = Approved entitlement − SUM(installments where status = PAID)
```

- Proposed/pending amounts **do not** reduce balance  
- Propose blocked if amount > outstanding (BR-05)  

---

## 9. Roles (SRS-aligned)

| Role code | Typical duty |
|-----------|----------------|
| SUPER_ADMIN | Full access |
| PENSION_RECORDS | Register pensioners, placements, schedules |
| SCHEDULE_PREP | Prepare payment lists |
| INTERNAL_AUDITOR | `schedule.audit` |
| DIRECTOR_GENERAL | `schedule.dg_approve` |
| DFA | `schedule.dfa_pay`, reconcile |
| CASHIER | Limited pay support |
| HR_OFFICER / MDA_RECORDS | Employees, early retirement |
| BENEFIT_CALC / REVIEWER / APPROVAL_OFFICER | Awards |
| FINANCE_OFFICER / PAYMENT_AUTHORIZER | Payments |
| VERIFICATION_OFFICER | Verification |
| CUSTOMER_SUPPORT | Complaints |
| PENSIONER | Portal only |

Sidebar shows **only** modules allowed by the user’s permissions.

---

## 10. Core business rules

| ID | Rule |
|----|------|
| BR-01 | Unique pension number |
| BR-03 | Placement history kept after activation |
| BR-04/07/12 | Outstanding uses confirmed payments only |
| BR-05 | No propose above outstanding |
| BR-06 | Stages before payment |
| BR-08 | Inactive/deceased/new-placement excluded from ordinary monthly prepare |
| BR-10 | Audit log on sensitive actions |

---

## 11. Public site

`/`, `/about`, `/services`, `/retirement-process`, `/pensioner-guide`, `/announcements`, `/faqs`, `/contact`, privacy/terms.

---

## 12. How modules link

```
Organization → Employee (+ service/salary)
       → RetirementCase → BenefitAssessment
       → Pensioner (+ PlacementRecord if pending)
       → GratuityEntitlement / PaymentSchedule items
       → Verification / Complaints / Portal user
```

---

## 13. Install (short)

```bash
docker compose up -d          # Postgres (use port 5433 if 5432 busy)
cp .env.example .env          # set DATABASE_URL, AUTH_SECRET
npm install --legacy-peer-deps
npx prisma generate && npx prisma db push
npm run db:seed
npm run dev
```

Demo password (all seed users): `ChangeMe@2026!`  
Admin: `admin@kscspms.kg.gov.ng`

---

## 14. Compatibility

See `docs/COMPATIBILITY-REPORT.md` — existing platform **partially met** SRS; redevelopment closed placements, gratuity ledger, gov workflow UI, SRS dashboard, and role set without discarding registry/auth/portal.

---

## 15. Not production-final (policy / integration)

- Official calculation circulars (not DEMO-FACTOR)  
- Live Paystack/Flutterwave keys + webhooks  
- Legacy pension DB migration  
- Full NOK + physical-file screens  
- MFA for DG/DFA  

*End of full system overview.*
