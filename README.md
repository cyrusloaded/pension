# Kogi State Civil Service Pension Management System (KSCSPMS)

**Enterprise platform for administering civil service pensions across Kogi State, Nigeria.**

This document explains **how the system works end-to-end**: architecture, modules, business logic, workflows, security, and day-to-day operations. It is written for technical implementers, system administrators, and operational officers who need more than a quick start guide.

---

## Table of contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [High-level architecture](#2-high-level-architecture)
3. [Technology stack](#3-technology-stack)
4. [Core design principles](#4-core-design-principles)
5. [Security and access control](#5-security-and-access-control)
6. [Domain model (data)](#6-domain-model-data)
7. [Public website](#7-public-website)
8. [Authentication and sessions](#8-authentication-and-sessions)
9. [Admin console modules](#9-admin-console-modules)
10. [Pensioner self-service portal](#10-pensioner-self-service-portal)
11. [Retirement workflow (state machine)](#11-retirement-workflow-state-machine)
12. [Benefit calculation logic](#12-benefit-calculation-logic)
13. [Payment and finance logic](#13-payment-and-finance-logic)
14. [Verification logic](#14-verification-logic)
15. [Complaints and notifications](#15-complaints-and-notifications)
16. [Document storage](#16-document-storage)
17. [Reports and audit](#17-reports-and-audit)
18. [API surface](#18-api-surface)
19. [Installation and environment](#19-installation-and-environment)
20. [Seed data and demo accounts](#20-seed-data-and-demo-accounts)
21. [Typical end-to-end business journey](#21-typical-end-to-end-business-journey)
22. [Operations and production notes](#22-operations-and-production-notes)
23. [How modules link to each other](#23-how-modules-link-to-each-other)
24. [Step-by-step: how the system works in practice](#24-step-by-step-how-the-system-works-in-practice)
25. [Step-by-step by actor](#25-step-by-step-by-actor-who-does-what)
26. [Worked example](#26-worked-example-one-person-through-the-whole-system)
27. [What happens if a link is missing](#27-what-happens-if-a-link-is-missing)
28. [Flow diagrams](#28-flow-diagrams)

---

## 1. Purpose and scope

KSCSPMS digitises the lifecycle of **civil service pensions** for Kogi State:

| Area | What the system does |
|------|----------------------|
| **Workforce registry** | Maintain employee records, service history, and salary history used for eligibility and awards |
| **Retirement processing** | Open and progress retirement cases through defined stages with audit trails |
| **Benefit assessment** | Calculate, review, and dual-approve gratuity and monthly pension using versioned rules |
| **Pensioner enrolment** | Create active pensioner records linked to bank details and (optionally) portal accounts |
| **Payroll / disbursement** | Prepare monthly payment schedules, authorise under dual control, reconcile bank returns |
| **Verification** | Confirm that pensioners remain eligible (life/identity verification) |
| **Service desk** | Accept and resolve pensioner complaints with reference numbers |
| **Transparency** | Public information pages; staff audit logs and operational reports |

The system is **database-backed**. Screens and APIs read and write real PostgreSQL records via Prisma. Workflow transitions and financial figures are enforced on the **server**, not only in the browser.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Users (browser)                         │
│  Public visitors │ Staff officers │ Pensioners              │
└────────────┬────────────────┬────────────────┬──────────────┘
             │                │                │
             ▼                ▼                ▼
┌──────────────────── Next.js 15 (App Router) ────────────────┐
│  Server Components (pages)  │  Client Components (forms)    │
│  Route Handlers (/api/*)    │  Middleware / session checks  │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────┐           ┌───────────────────────────┐
│  Domain libraries  │           │  Storage drivers          │
│  auth, RBAC,       │           │  local ./uploads or       │
│  workflows,        │           │  S3 / MinIO               │
│  calculations,     │           └───────────────────────────┘
│  audit, import     │
└────────────┬───────┘
             │
             ▼
┌──────────────────── Prisma ORM ─────────────────────────────┐
│                      PostgreSQL                             │
└─────────────────────────────────────────────────────────────┘
```

- **Presentation**: React Server Components for data-heavy admin pages; client components for interactive forms.
- **API**: Next.js Route Handlers under `src/app/api/**` perform permission checks, validation (Zod), business rules, and persistence.
- **Domain logic**: Shared TypeScript modules under `src/lib/**` (workflows, benefit engine, storage, permissions).
- **Persistence**: Single PostgreSQL database; schema defined in `prisma/schema.prisma`.

There is no separate microservice layer in this codebase: the Next.js app is the full stack application.

---

## 3. Technology stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, Lucide icons, institutional navy/teal palette |
| ORM | Prisma 6 |
| Database | PostgreSQL 16+ |
| Auth | HTTP-only session cookie + signed token (`AUTH_SECRET`), bcrypt password hashes |
| Validation | Zod (shared client/server patterns) |
| Object storage | Local filesystem or S3-compatible (MinIO / AWS) via `STORAGE_DRIVER` |
| Infra (dev) | Docker Compose for Postgres (optional MinIO) |
| Tests | Vitest unit tests for engine, workflows, rate limit, upload validation |

---

## 4. Core design principles

1. **Real data only** — Lists, dashboards, and reports query the database. Seed data is for bootstrap/demo; production data is entered through authorised workflows.
2. **Server-side enforcement** — Stage transitions, payment status changes, and benefit approvals are validated in API handlers and workflow helpers. A forged browser request cannot skip stages without the correct permission and allowed transition.
3. **Separation of duties** — Benefit calculation, review, and approval are distinct permissions. Payment preparation and authorisation are distinct. The same officer should not complete every financial step alone where policy requires dual control.
4. **Versioned calculation rules** — Award amounts come from approved `PensionRuleVersion` records. Officers do not type over calculated totals as the source of truth.
5. **Auditability** — Sensitive creates/updates write `AuditLog` entries (actor, action, entity, before/after, outcome).
6. **Least privilege** — UI navigation and APIs both check permissions. Users only see modules their roles allow.

---

## 5. Security and access control

### 5.1 Roles

System roles (seeded) include among others:

| Role code | Typical use |
|-----------|-------------|
| `SUPER_ADMIN` | Full system control |
| `SYSTEM_ADMIN` | Technical administration |
| `PENSION_DIRECTOR` / `PENSION_ADMIN` | Oversight and pension operations |
| `HR_OFFICER` / `MDA_RECORDS` / `LGA_RECORDS` | Employee records and case initiation |
| `VERIFICATION_OFFICER` | Life/identity verification |
| `BENEFIT_CALC` / `BENEFIT_REVIEWER` / `APPROVAL_OFFICER` | Assessment pipeline |
| `FINANCE_OFFICER` / `PAYMENT_AUTHORIZER` / `RECONCILIATION_OFFICER` | Payroll pipeline |
| `CUSTOMER_SUPPORT` | Complaints |
| `INTERNAL_AUDITOR` | Audit and reports (read-heavy) |
| `READ_ONLY` | View-oriented access |
| `PENSIONER` | Self-service portal only |

### 5.2 Permissions

Permissions are fine-grained strings such as `employees.read`, `retirements.review`, `benefits.approve`, `payments.authorize`. They are stored in the database, linked to roles via `RolePermission`, and checked with helpers such as `hasPermission(session, PERMISSIONS.…)` in pages and APIs.

Super Admin receives **all** permissions at seed time. Other roles receive a curated matrix (for example HR can create employees and retirement cases; finance can prepare payments but not necessarily approve benefits).

### 5.3 Session and login protection

- Passwords are hashed with **bcrypt**.
- Sessions use a secret (`AUTH_SECRET`); cookies are HTTP-only (and `secure` in production).
- Failed login attempts can lock an account after a threshold.
- **Rate limiting** on login reduces brute-force risk (in-memory limiter suitable for single-node; use Redis for multi-instance production).
- Security response headers (e.g. `X-Frame-Options`, `X-Content-Type-Options`, CSP) are configured in `next.config.ts`.

### 5.4 Unauthorised access

Routes under `/admin/*` and `/portal/*` require a valid session. Missing permissions redirect to `/unauthorized` or return HTTP 403 from APIs.

---

## 6. Domain model (data)

Major entities (simplified):

| Entity | Role in the business |
|--------|----------------------|
| **Organization** | Ministries, agencies, LGAs; hierarchy via `parentId` |
| **User** | Login identity; optional link to organization; many-to-many **Role** |
| **Employee** | Serving or former civil servant registry record |
| **ServiceHistory** / **SalaryHistory** | Evidence for qualifying service and final salary |
| **PensionScheme** / **PensionRuleVersion** | Scheme definition and versioned calculation parameters (`rulesJson`) |
| **RetirementCase** | One retirement file with `currentStage` and `status` |
| **RetirementDocument** / **RetirementTimeline** | File checklist and stage history |
| **BenefitAssessment** | Calculated gratuity / monthly pension and approval state |
| **Pensioner** | Enrolled payee; bank details; payment and verification status |
| **VerificationCase** | Periodic or ad-hoc verification work item |
| **PaymentSchedule** / **PaymentScheduleItem** | Monthly batch and per-pensioner lines |
| **Arrear** | Back-pay obligation tracked to resolution |
| **PaymentReconciliation** | Bank return vs expected schedule totals |
| **Complaint** | Service desk ticket |
| **Notification** | In-app alerts for users |
| **AuditLog** | Immutable-style operational trail |
| **Announcement** / **SystemSetting** | Public notices and configuration keys |

Relationships enforce integrity (for example a pensioner may link to one employee and one completed retirement case). Financial amounts use **Decimal** columns in PostgreSQL.

---

## 7. Public website

Unauthenticated pages provide citizen-facing information (not transactional case processing):

| Path | Content |
|------|---------|
| `/` | Home |
| `/about` | About the Board / system |
| `/services` | Services overview |
| `/retirement-process` | How retirement is processed |
| `/pensioner-guide` | How to use the portal |
| `/announcements` | Official notices |
| `/faqs` | Frequently asked questions |
| `/contact` | Contact channels |
| `/privacy-policy`, `/terms`, `/accessibility` | Legal / a11y |

Shared chrome: `PublicHeader`, `PublicFooter`, `PublicPage` layout component. **Portal Login** links to `/login`.

---

## 8. Authentication and sessions

### Login flow

1. User submits identifier (email, username, or staff number) and password to `POST /api/auth/login`.
2. Server rate-limits by IP, loads the user, checks lockout, verifies bcrypt hash.
3. On success, creates a session and sets the cookie; may write login history / audit.
4. Client is redirected to admin or portal depending on roles.

### Logout

Clears the session cookie via the logout API and returns the user to the public site or login page.

### Password policy (operational)

Seeded accounts use `mustChangePassword: true`. Production deployments should enforce password change, strong secrets in `.env`, and disable default accounts after handover.

---

## 9. Admin console modules

Base path: `/admin/*`. Sidebar is role-aware.

### 9.1 Dashboard

**Path:** `/admin/dashboard`  

Live aggregates from the database (counts of employees, open retirements, pensioners, payments, verification queue, complaints, etc.). Gives officers a situational overview without exporting data.

### 9.2 Organizations

**Path:** `/admin/organizations`  

Maintain MDAs and LGAs (`Organization`). Codes (e.g. `KG-MOE`, `LGA-LOKOJA`) are used in bulk employee import and reporting. Types include MINISTRY, AGENCY, LGA, and others defined in the schema.

### 9.3 Users and roles

**Paths:** `/admin/users`, `/admin/roles`  

- Create staff users, assign one or more roles, link to an organization.  
- Roles list shows system roles and associated permissions.  
- Only users with `users.manage` / `roles.manage` (or Super Admin) should administer this area.

### 9.4 Employees

**Paths:** `/admin/employees`, `/admin/employees/new`, `/admin/employees/[id]`, `/admin/employees/[id]/edit`, `/admin/employees/import`

**Functions:**

| Function | Behaviour |
|----------|-----------|
| Register | Creates an `Employee` with biodata, org, grade/step, employment status |
| Search / filter | Staff number, name, status, organization |
| Detail | Overview, service history, salary history, linked retirement cases / pensioner |
| Service history | Append postings/grades with start/end dates |
| Salary history | Append basic/allowances/total effective from a date |
| Edit | PATCH allowed fields with uniqueness checks on staff number / NIN |
| Archive | Soft-archive (`isArchived`, status ARCHIVED) with audit reason |
| Bulk import | CSV/JSON up to 500 rows; skips duplicate staff numbers and NINs |

Employee data is the **source** for retirement eligibility and final salary inputs.

### 9.5 Retirements

**Paths:** `/admin/retirements`, case detail under `/admin/retirements/[id]`

**Functions:**

- Open a case against an employee (reference generated or assigned).  
- View current stage, status (OPEN / ON_HOLD / CLOSED / REJECTED), assignee, notes.  
- Register documents (metadata and/or file upload).  
- Advance stage only along **allowed transitions** (see §11).  
- Timeline records who did what and when.  
- At enrolment stage, system can create the **Pensioner** record.

Permissions: `retirements.create`, `retirements.review`, `retirements.read`.

### 9.6 Benefits and approvals

**Paths:** `/admin/benefits`, `/admin/benefits/[id]`, `/admin/approvals`, `/admin/gratuity`, `/admin/pension-rules`

**Functions:**

- Create a `BenefitAssessment` linked to a retirement case and rule version.  
- Run **server-side calculation** (see §12).  
- Submit for review; reviewer comments; approver finalises.  
- Separation of duties: calculator should not be the sole approver of their own assessment where enforced.  
- Pension rules admin: draft → approve → supersede rule versions; `rulesJson` holds factors and method.  
- Approval centre aggregates items needing attention across queues.

### 9.7 Pensioners

**Paths:** `/admin/pensioners`, detail views  

Enrolled payees: pensioner number, monthly pension, payment status (PENDING / ACTIVE / SUSPENDED / STOPPED), verification status, bank fields (account numbers should be masked in routine UI). Linking `userId` enables portal login.

### 9.8 Verification

**Path:** `/admin/verification`  

Queue of `VerificationCase` records (e.g. ANNUAL). Officers schedule, progress, and decide APPROVED / REJECTED / MORE_INFO. Failed or overdue verification can drive payment suspension as a business policy (status fields support this; operational procedure is organisational).

### 9.9 Payments, arrears, reconciliation

**Paths:** `/admin/payment-schedules`, `/admin/arrears`, `/admin/reconciliation`

See §13 for detailed logic. UI supports preparing schedules from active pensioners, dual-control status changes, arrear capture/approval, and reconciling bank returns against schedules.

### 9.10 Complaints

**Path:** `/admin/complaints`  

Staff view of the service desk: filter by status, assign, mark in progress, resolve/close with resolution text. Pensioners may be notified on status change.

### 9.11 Reports

**Path:** `/admin/reports`  

Operational and financial report types (overview, employees, pensioners, retirement pipeline, payments, verification, complaints). Data is queried live. Users with `reports.export` can download **CSV** for the active report type.

### 9.12 Audit logs

**Path:** `/admin/audit-logs`  

Searchable trail of privileged actions for internal audit and incident review.

### 9.13 Notifications and settings

**Paths:** `/admin/notifications`, `/admin/settings`  

In-app notification inbox for the signed-in officer; settings overview and production checklist (secrets, backups, HTTPS, health endpoint, storage driver).

---

## 10. Pensioner self-service portal

Base path: `/portal/*` (requires a user with pensioner linkage).

| Page | Function |
|------|----------|
| Dashboard | Summary of payment status, pension amount, alerts |
| Payments | History of schedule items; **Download CSV** export |
| Documents | Case/document list with authenticated download |
| Verification | View/book verification-related activity |
| Profile | View identity and request bank detail updates (audited) |
| Complaints | Submit and track tickets with reference numbers |
| Notifications | Read alerts (payment authorised, complaint updates, etc.) |

Portal users must not access admin finance or case-approval screens. APIs scope data to the pensioner linked to `session.id`.

---

## 11. Retirement workflow (state machine)

Implemented in `src/lib/workflows/retirement.ts` and enforced by retirement APIs.

### Stages (in order of the happy path)

1. `ELIGIBILITY_ASSESSMENT`  
2. `NOTIFICATION`  
3. `APPLICATION`  
4. `DOCUMENT_SUBMISSION`  
5. `SERVICE_VERIFICATION`  
6. `CASE_REVIEW`  
7. `MISSING_INFO` (exception path — return for more data)  
8. `BENEFIT_ASSESSMENT`  
9. `CALCULATION_REVIEW`  
10. `APPROVAL`  
11. `PENSIONER_ENROLMENT`  
12. `PAYMENT_PREPARATION`  
13. `PAYMENT_AUTHORIZATION`  
14. `DISBURSEMENT`  
15. `CLOSED`  

### Transition rules (logic)

- Each stage has a fixed set of **allowed next stages**.  
- Example: from `CASE_REVIEW` you may go to `BENEFIT_ASSESSMENT`, `MISSING_INFO`, back to `DOCUMENT_SUBMISSION`, or `CLOSED` — not jump to `DISBURSEMENT`.  
- `CLOSED` has no further transitions.  
- Stage moves require the appropriate permission (create vs review).  
- Every successful transition should append a **timeline** entry for accountability.  
- Case `status` (OPEN, ON_HOLD, CLOSED, REJECTED) is orthogonal to stage and reflects whether the file is still active.

### Documents

Required document types are defined in workflow constants (appointment letter, promotions, identity, etc.). Officers register metadata and/or upload binaries. Uploads are validated for type and size before storage.

### Enrolment

When the case reaches pensioner enrolment (and policy checks pass), a **Pensioner** row is created with pensioner number, amounts from the approved assessment, and optional portal user link.

---

## 12. Benefit calculation logic

Implemented in `src/lib/calculations/benefit-engine.ts`.

### Inputs

- Qualifying service years (from service history / case data)  
- Final salary (from salary history / case data)  
- **Rule version** JSON, for example:

```json
{
  "calculationMethod": "FACTOR",
  "monthlyPensionFactor": 0.5,
  "gratuityPerYearOfService": 1,
  "rounding": "NEAREST_NAIRA",
  "eligibilityMinYears": 10
}
```

### Methods

| Method | Behaviour |
|--------|-----------|
| `PLACEHOLDER` | Returns **not production-ready**; no payable amounts. Forces configuration of real rules. |
| `FACTOR` | Applies configured factors to salary and years (demo seed uses simple factors for testing only). |

### Process

1. Officer creates assessment on a retirement case.  
2. Server loads the selected **approved** rule version.  
3. Engine computes monthly pension, gratuity, warnings.  
4. Results stored on `BenefitAssessment` (breakdown JSON, amounts, status).  
5. Reviewer and approver move status: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED (or RETURNED / REJECTED).

**Important:** Official Kogi statutory formulae must be entered by authorised administrators into rule versions before live awards. Demo `DEMO-FACTOR` rules are **not** official rates.

---

## 13. Payment and finance logic

Implemented with payment workflow helpers (`src/lib/workflows/payments.ts`) and payment APIs.

### Payment schedule lifecycle

Typical statuses include: `DRAFT` → `PENDING_REVIEW` → `APPROVED` / authorised processing states → disbursement success → `RECONCILED` (exact labels follow schema and UI).

**Rules of logic:**

1. **Prepare** — Finance selects a payment period and builds items from **ACTIVE** pensioners (amount ≈ monthly pension; bank snapshot copied onto the item).  
2. **Dual control** — Preparation and **authorisation** require different permissions (`payments.prepare` vs `payments.authorize`). Invalid status jumps are rejected by `canTransitionPayment`.  
3. **Items** — Each `PaymentScheduleItem` holds gross/adjustments/deductions/net and per-line status (PENDING, PAID, failed with reason, etc.).  
4. **Arrears** — Separate `Arrear` records track unpaid periods (`reference`, months, amounts, OPEN → APPROVED → PAID / WRITTEN_OFF).  
5. **Reconciliation** — After bank processing, expected vs actual totals and matched item counts are recorded on `PaymentReconciliation`.

### Pensioner payment status

`Pensioner.paymentStatus` (ACTIVE, SUSPENDED, STOPPED, PENDING) controls inclusion in future schedules and portal messaging. Suspension often follows failed verification or administrative stoppage.

---

## 14. Verification logic

1. Create a `VerificationCase` (type such as ANNUAL) for a pensioner/employee.  
2. Schedule a date; assign an officer.  
3. Collect evidence if needed (`VerificationEvidence`).  
4. Decision: APPROVED, REJECTED, or MORE_INFO with reason.  
5. Update pensioner `verificationStatus` and, by procedure, payment eligibility.

Portal users may request or view verification activity without seeing other pensioners’ data.

---

## 15. Complaints and notifications

### Complaints

- Created by pensioners (portal) or recorded by staff.  
- Unique **reference** (e.g. `CMP-2026-0003`).  
- Status flow: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED (REOPENED allowed operationally).  
- Category examples: PAYMENT, VERIFICATION, DOCUMENT, SERVICE.  
- Resolution text is visible to the pensioner when notified.

### Notifications

- Stored per `userId`.  
- Triggered by events such as case assignment, payment authorisation, complaint updates.  
- Admin and portal each have a notifications UI; mark-all-read is supported.

---

## 16. Document storage

### Validation (`src/lib/storage/validate-upload.ts`)

| Control | Rule |
|---------|------|
| Max size | 10 MB |
| Extensions | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.doc`, `.docx` |
| MIME | Matched allow-list |
| Content | Magic-byte sniffing so renamed executables are rejected |

Client-side checks improve UX; **server always re-validates**.

### Drivers (`STORAGE_DRIVER`)

| Driver | Behaviour |
|--------|-----------|
| `local` (default) | Files under `./uploads` (not publicly served) |
| `s3` | S3-compatible API (MinIO or AWS); private objects; download via presigned URL or authenticated stream |

### Download

`GET /api/documents/[id]/download` checks that the caller is authorised staff or the owning pensioner, then streams or redirects. Never expose raw storage keys as public URLs.

---

## 17. Reports and audit

### Reports

Report types are generated from Prisma aggregates/queries (`src/lib/reports/queries.ts`):

- System overview counts  
- Employee headcount by status/org  
- Pensioner payment/verification mix  
- Retirement pipeline by stage  
- Payments and arrears snapshot  
- Verification queue  
- Complaints workload  

CSV export uses a small serializer and permission `reports.export`.

### Audit

`writeAuditLog` captures actor identity, action codes (e.g. `EMPLOYEE.UPDATE`, `DOCUMENT.UPLOAD`, `SEED.COMPLETED`), entity ids, and JSON before/after snapshots. Auditors use `/admin/audit-logs` filters rather than direct DB access.

---

## 18. API surface

Representative groups under `src/app/api/`:

| Group | Purpose |
|-------|---------|
| `auth/login`, `auth/logout` | Session lifecycle |
| `employees`, `employees/import`, `employees/[id]` | Registry CRUD, archive, bulk import |
| `organizations`, `users` | Structure and staff accounts |
| `retirements`, `retirements/[id]/…` | Cases, transitions, documents |
| `benefits`, `pension-rules` | Assessments and rule versions |
| `pensioners`, `verification` | Enrolment and verification decisions |
| `payments`, `arrears`, `reconciliation` | Finance pipeline |
| `complaints`, `notifications` | Service desk and alerts |
| `documents/upload`, `documents/[id]/download` | Binary handling |
| `reports` | JSON + CSV |
| `audit-logs` | Audit query |
| `portal/payments/export` | Pensioner CSV history |
| `health` | Liveness/readiness (DB probe) |

All mutating endpoints should: authenticate → authorise → validate → apply domain rules → persist → audit → respond.

---

## 19. Installation and environment

### Prerequisites

- Node.js 20+ (Node 24 works)  
- npm  
- PostgreSQL (Docker recommended)  
- Optional: Docker Desktop for `docker compose`

### Critical environment variables

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/kscspms?schema=public"
AUTH_SECRET="long-random-string-at-least-32-chars"
SESSION_SECRET="another-long-random-string"
STORAGE_DRIVER="local"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

On Windows, if a local PostgreSQL service already uses port **5432**, map Docker to **5433** and set that port in `DATABASE_URL`.

### Standard commands

```bash
docker compose up -d          # Postgres
cp .env.example .env          # then edit
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Health check: `GET /api/health`.

---

## 20. Seed data and demo accounts

`npm run db:seed` loads permissions, roles, organisations, scheme/rules, staff users, employees, histories, retirement cases, benefits, a pensioner, verification, payments, arrears, reconciliation, complaints, notifications, announcements, and settings.

**Default password for all demo users:** `ChangeMe@2026!`

| Email | Role |
|-------|------|
| `admin@kscspms.kg.gov.ng` | Super Admin |
| `hr@kscspms.kg.gov.ng` | HR Officer |
| `records@kscspms.kg.gov.ng` | MDA Records |
| `verify@kscspms.kg.gov.ng` | Verification |
| `benefits@kscspms.kg.gov.ng` | Benefit Calc |
| `review@kscspms.kg.gov.ng` | Benefit Reviewer |
| `approve@kscspms.kg.gov.ng` | Approval |
| `finance@kscspms.kg.gov.ng` | Finance |
| `payauth@kscspms.kg.gov.ng` | Payment Authorizer |
| `support@kscspms.kg.gov.ng` | Customer Support |
| `pensioner.demo@kscspms.kg.gov.ng` | Pensioner portal (`PEN/KG/2025/0001`) |

Change all default passwords before any production use.

---

## 21. Typical end-to-end business journey

1. **HR / Records** registers the employee and maintains service and salary history.  
2. Near retirement, an officer **opens a retirement case** and moves it through eligibility, notification, application, and document collection.  
3. **Service verification** and **case review** confirm the file is complete.  
4. **Benefit calculation** runs against an approved rule version; **reviewer** and **approver** sign off under dual control.  
5. **Pensioner enrolment** creates the payee record and bank details; optional portal account is linked.  
6. **Finance** prepares the monthly schedule; **payment authorizer** releases it; bank pays; **reconciliation** closes the loop.  
7. **Verification** officers run annual checks so payments remain legitimate.  
8. **Pensioner** uses the portal to view payments, download history, and raise complaints.  
9. **Auditors** inspect audit logs and reports for compliance.

Each step leaves database evidence: case timeline, assessment statuses, schedule statuses, and audit rows.

---

## 22. Operations and production notes

| Topic | Guidance |
|-------|----------|
| Secrets | Unique strong `AUTH_SECRET` / DB passwords per environment; never commit `.env` |
| HTTPS | Terminate TLS at reverse proxy; enable secure cookies in production |
| Backups | Automated PostgreSQL backups and tested restore |
| Storage | Use S3/MinIO for multi-node; keep buckets private |
| Rate limit | Replace in-memory limiter with Redis when scaling out |
| Rules | Only approved official rule versions for live awards |
| Monitoring | Monitor `/api/health`, error logs, disk for `uploads/` |
| Upgrades | Run `prisma migrate` / `db push` in a controlled window; regenerate client |

---

## Project layout (reference)

```
prisma/
  schema.prisma      # Data model
  seed.ts            # Bootstrap / demo data
src/
  app/
    (public pages)
    admin/           # Staff console
    portal/          # Pensioner console
    api/             # Route handlers
    login/
  components/        # UI shell and shared controls
  lib/
    auth/            # Session, password
    permissions/     # Permission constants
    workflows/       # Retirement & payment state machines
    calculations/    # Benefit engine
    storage/         # Local + S3 drivers, validation
    audit/           # Audit writer
    reports/         # Queries + CSV
    validation/      # Zod schemas
    import/          # Bulk employee import
tests/               # Vitest unit tests
docker-compose.yml
```

---

## 23. How modules link to each other

The system is one chain of records. Each module writes or reads data that the next module depends on. Nothing important lives only in the UI.

### 23.1 Dependency map (who needs whom)

```
 Organizations ──► Users (staff belong to an org)
       │
       ├──► Employees (posted under an org)
       │         │
       │         ├── Service History ──┐
       │         ├── Salary History ───┼──► Retirement Case
       │         └── Employee Documents┘         │
       │                                         ├── Documents + Timeline
       │                                         ├── Benefit Assessment ◄── Pension Rules
       │                                         │         │
       │                                         └──► Pensioner ◄────────────┘
       │                                                   │
       │                          ┌────────────────────────┼────────────────────────┐
       │                          ▼                        ▼                        ▼
       │                   Verification              Payment Schedule            Complaints
       │                          │                        │                        │
       │                          │                        ├── Schedule Items
       │                          │                        ├── Arrears
       │                          │                        └── Reconciliation
       │                          │
       └── Portal User ◄── linked to Pensioner (optional userId)
```

### 23.2 Link table (module → module)

| From module | Links to | How |
|-------------|----------|-----|
| **Organizations** | Employees, Users, Pensioners | `organizationId` foreign key |
| **Users + Roles** | Every admin/portal action | Session carries user id + permission set |
| **Employees** | Retirements, Pensioners, Verification | Case and pensioner point at `employeeId` |
| **Service / Salary history** | Benefit assessment | Years of service and final salary inputs |
| **Pension rules** | Benefit assessment | `ruleVersionId` selects `rulesJson` factors |
| **Retirement cases** | Documents, timeline, benefits, pensioner | All child records use `retirementCaseId` |
| **Benefit assessments** | Pensioner enrolment | Approved monthly pension / gratuity copied to payee |
| **Pensioners** | Payments, arrears, verification, complaints, portal | `pensionerId` on those tables; optional `userId` for login |
| **Payment schedules** | Schedule items, reconciliation | Items list who is paid; recon ties to one schedule |
| **Verification** | Pensioner payment eligibility | Decision updates `verificationStatus` / may affect `paymentStatus` |
| **Complaints** | Pensioner + support staff | Ticket reference; notifications to portal user |
| **Notifications** | Any module event | Written when cases/payments/complaints change |
| **Audit log** | All sensitive modules | Parallel write on create/update/approve/upload |
| **Reports** | All of the above | Read-only aggregates; no separate data store |
| **Documents / storage** | Retirement (and employee) files | `filePath` / storage key on document rows |

### 23.3 Shared “spine” records

Three records carry almost the whole lifecycle:

1. **Employee** — identity while in service (and historical link after retirement).  
2. **RetirementCase** — the file that moves through stages until closed.  
3. **Pensioner** — the payee after enrolment; drives payroll and portal.

If the employee is wrong, the case is wrong. If the case never reaches approved benefits, enrolment amounts are wrong. If the pensioner is suspended, payment schedules should not treat them as normal ACTIVE payees.

---

## 24. Step-by-step: how the system works in practice

### Step A — Platform setup (once)

1. Deploy app + PostgreSQL; set `DATABASE_URL` and `AUTH_SECRET`.  
2. Run migrations/schema push and **seed** (permissions, roles, orgs, admin).  
3. Super Admin configures **Organizations** (MDAs/LGAs) and **Users** with correct roles.  
4. Super Admin / Pension Admin configures **Pension scheme** and **approved rule versions** (official factors — not demo placeholders — before live awards).  
5. Confirm **storage** (`local` or S3) for document uploads.

**Modules used:** Settings/env, Organizations, Users, Roles, Pension Rules, Storage.

---

### Step B — Build the employee register

1. HR or MDA Records opens **Employees → Register** (or **Bulk import**).  
2. Employee is stored with org, grade, appointment date, NIN, etc.  
3. Officers add **Service history** (postings over time) and **Salary history** (pay over time).  
4. Optional employee document metadata is attached.

**Why it matters later:** Retirement eligibility and benefit inputs are derived from this history. Payment and pensioner screens can navigate back to the same person via `employeeId`.

**Modules used:** Organizations → Employees → Service History → Salary History → (Documents).

---

### Step C — Open and progress a retirement case

1. HR/Records creates a **Retirement case** for an employee nearing retirement.  
2. System sets stage to early workflow stage (e.g. eligibility / application path).  
3. Case is assigned; **Notifications** may alert the assignee.  
4. Officer advances stages only along the **allowed transition graph** (server-checked).  
5. At document stages, files are uploaded or registered; **Timeline** records each action.  
6. If information is incomplete, stage moves to **MISSING_INFO**, then back when fixed.  
7. **Audit log** records critical updates.

**Links:** `RetirementCase.employeeId` → Employee; documents/timeline → case id.

**Modules used:** Employees → Retirements → Documents → Notifications → Audit.

---

### Step D — Calculate and approve benefits

1. When the case reaches benefit stages, a **Benefit Assessment** is created.  
2. Officer selects a **Pension rule version**.  
3. **Benefit engine** (server) computes monthly pension and gratuity from service years + final salary + `rulesJson`.  
4. Assessment moves DRAFT → submitted → reviewed → **APPROVED** (separate permissions).  
5. Approval centre lists items waiting on review/approve roles.

**Links:** Assessment → `retirementCaseId` + `ruleVersionId`. Approved amounts become the source for enrolment.

**Modules used:** Retirements → Pension Rules → Benefits → Approvals → Audit.

---

### Step E — Enrol the pensioner

1. Case reaches **PENSIONER_ENROLMENT** (after approval).  
2. System creates **Pensioner** (number, monthly pension, bank fields, statuses).  
3. Optionally link a **User** with role `PENSIONER` so the person can use the portal.  
4. Case can continue toward payment preparation stages or close when complete.

**Links:** Pensioner → employee, retirement case, organization, scheme; optional `userId` → portal.

**Modules used:** Retirements → Benefits → Pensioners → Users (portal) → Notifications.

---

### Step F — Monthly payment run

1. **Finance** opens **Payment schedules** and prepares a period (e.g. `2026-03`).  
2. System builds **PaymentScheduleItem** rows for pensioners with suitable **paymentStatus** (typically ACTIVE).  
3. Amounts come from pensioner monthly pension (and any adjustments/deductions).  
4. Another officer with **payments.authorize** advances schedule status (dual control).  
5. After bank processing, lines are marked paid; **Reconciliation** matches bank totals to the schedule.  
6. **Arrears** module records any back periods still owed, then approval/payment of those amounts.

**Links:** Schedule items → `pensionerId`; reconciliation → `scheduleId`; arrears → `pensionerId`.

**Modules used:** Pensioners → Payment Schedules → Arrears → Reconciliation → Reports → Audit.

---

### Step G — Keep payments legitimate (verification)

1. **Verification** officer creates or opens annual (or other) verification cases.  
2. Pensioner may be notified via **portal / notifications**.  
3. Decision APPROVED / REJECTED / MORE_INFO is stored on the case.  
4. Pensioner `verificationStatus` updates; failed verification may lead to **paymentStatus = SUSPENDED** under local procedure.  
5. Suspended pensioners drop out of normal “active” payroll selection until restored.

**Links:** VerificationCase → pensioner (and optionally employee).

**Modules used:** Pensioners → Verification → (Payments) → Notifications → Portal.

---

### Step H — Service desk and self-service

1. Pensioner logs into **Portal**, sees payments, documents, verification, profile.  
2. Raises a **Complaint**; system assigns a reference number.  
3. **Customer Support** works the queue in admin complaints; resolution text is saved.  
4. Notification informs the pensioner of progress.  
5. Staff may **export CSV** reports; pensioner may **download payment history CSV**.

**Links:** Complaint → `pensionerId`; portal APIs always filter by the logged-in user’s linked pensioner.

**Modules used:** Portal ↔ Pensioners ↔ Payments ↔ Complaints ↔ Notifications ↔ Reports.

---

### Step I — Oversight

1. Directors use **Dashboard** and **Reports** for counts and pipelines.  
2. **Internal Auditor** reviews **Audit logs** for who approved what.  
3. No separate reporting database — reports read the same operational tables.

**Modules used:** All modules (read) → Dashboard / Reports / Audit Logs.

---

## 25. Step-by-step by actor (who does what)

### Super Admin / System Admin

1. Manage organizations, users, roles.  
2. Configure pension rule versions and system settings.  
3. Monitor health, storage, and audit anomalies.

### HR / MDA / LGA Records

1. Create and update employees.  
2. Maintain service and salary history.  
3. Open retirement cases and submit documents.  
4. Move early workflow stages; respond to MISSING_INFO.

### Benefit Calc → Reviewer → Approver

1. Calculate assessment from rules + history.  
2. Independent review.  
3. Final approval (dual control).

### Finance → Payment Authorizer → Reconciliation

1. Prepare monthly schedule from ACTIVE pensioners.  
2. Authorise release.  
3. Reconcile bank response; manage arrears.

### Verification Officer

1. Run verification queue.  
2. Record decisions that protect the payroll.

### Customer Support

1. Manage complaints linked to pensioners.  
2. Coordinate with finance/verification when the issue is payment or verification related.

### Pensioner

1. Log in to portal only.  
2. View payments, download history, update bank request path, book/view verification, file complaints.

---

## 26. Worked example (one person through the whole system)

**Person:** Joseph Adamu (demo seed).

| Step | Module | Record created / updated |
|------|--------|---------------------------|
| 1 | Organizations | Posted under Ministry of Education |
| 2 | Employees | Staff `KG/EDU/1985/0007`, later status RETIRED |
| 3 | Service / Salary history | Years and final salary for calculation |
| 4 | Retirements | Case `RC-2024-0088` progressed to CLOSED |
| 5 | Pension Rules | Assessment used `DEMO-FACTOR-v1` |
| 6 | Benefits | Assessment `BA-2024-0088` APPROVED (e.g. ₦140,000 monthly) |
| 7 | Pensioners | `PEN/KG/2025/0001` ACTIVE, bank account stored |
| 8 | Users | Portal login `pensioner.demo@kscspms.kg.gov.ng` linked via `userId` |
| 9 | Payments | Item on schedule `PAY-2026-03` marked PAID |
| 10 | Reconciliation | `REC-2026-03` MATCHED to that schedule |
| 11 | Verification | `VER-2025-0001` APPROVED |
| 12 | Complaints | Optional tickets `CMP-…` on same pensioner |
| 13 | Portal | Same user sees payment history and notifications |
| 14 | Audit / Reports | Counts and logs include these entities |

This is the intended pattern for every retiree: **one employee → one (or more) cases → one approved assessment → one pensioner → many payment lines over time**, with verification and complaints hanging off the pensioner, and audit watching the critical writes.

---

## 27. What happens if a link is missing

| Missing link | Symptom |
|--------------|---------|
| Employee without org | Cannot place correctly in MDA reports; import may fail |
| Case without employee | Not allowed by schema / API |
| Assessment without approved rules | PLACEHOLDER engine blocks production-ready amounts |
| Pensioner without approved benefits | Enrolment amounts incomplete or manual-only risk |
| Pensioner without ACTIVE status | Excluded from normal monthly prepare |
| Portal user without `pensioner.userId` | Login works as user but portal shows “no pensioner linked” |
| Schedule without items | Nothing to pay or reconcile |
| Verification rejected, payment still ACTIVE | Policy gap — operators should suspend payment status |

Understanding these links is essential for support: fix the **upstream** record (employee/case/assessment), not only the screen that shows the error.

---


## 28. Flow diagrams

The diagrams below show how work and data move through KSCSPMS.  
(Mermaid renders on GitHub, GitLab, and many Markdown viewers. ASCII works everywhere.)

### 28.1 End-to-end business flow

```mermaid
flowchart TD
  A[Organization & User setup] --> B[Register Employee]
  B --> C[Service + Salary History]
  C --> D[Open Retirement Case]
  D --> E[Documents & Stage Transitions]
  E --> F{Case complete?}
  F -->|No - Missing info| E
  F -->|Yes| G[Benefit Assessment]
  G --> H[Rule Engine Calculate]
  H --> I[Review]
  I --> J[Approve]
  J --> K[Enrol Pensioner]
  K --> L[Monthly Payment Schedule]
  L --> M[Authorize Payment]
  M --> N[Bank Disbursement]
  N --> O[Reconciliation]
  K --> P[Verification Cycle]
  P -->|Failed| Q[Suspend Payment Status]
  P -->|Passed| L
  K --> R[Pensioner Portal]
  R --> S[Complaints / Payment History]
  Q --> L
```

### 28.2 Module relationship flow

```mermaid
flowchart LR
  subgraph Setup
    ORG[Organizations]
    USR[Users / Roles]
    RUL[Pension Rules]
  end

  subgraph Registry
    EMP[Employees]
    SH[Service History]
    SA[Salary History]
  end

  subgraph Retirement
    RC[Retirement Case]
    DOC[Documents]
    TL[Timeline]
    BA[Benefit Assessment]
  end

  subgraph Payee
    PEN[Pensioner]
    VER[Verification]
    PAY[Payment Schedules]
    ARR[Arrears]
    REC[Reconciliation]
    CMP[Complaints]
    POR[Portal]
  end

  ORG --> EMP
  ORG --> USR
  USR --> RC
  EMP --> SH
  EMP --> SA
  EMP --> RC
  RUL --> BA
  RC --> DOC
  RC --> TL
  RC --> BA
  BA --> PEN
  EMP --> PEN
  PEN --> VER
  PEN --> PAY
  PEN --> ARR
  PEN --> CMP
  PEN --> POR
  PAY --> REC
  USR --> POR
```

### 28.3 Retirement stage flow

```mermaid
stateDiagram-v2
  [*] --> ELIGIBILITY_ASSESSMENT
  ELIGIBILITY_ASSESSMENT --> NOTIFICATION
  NOTIFICATION --> APPLICATION
  APPLICATION --> DOCUMENT_SUBMISSION
  DOCUMENT_SUBMISSION --> SERVICE_VERIFICATION
  DOCUMENT_SUBMISSION --> MISSING_INFO
  SERVICE_VERIFICATION --> CASE_REVIEW
  SERVICE_VERIFICATION --> MISSING_INFO
  MISSING_INFO --> DOCUMENT_SUBMISSION
  MISSING_INFO --> CASE_REVIEW
  CASE_REVIEW --> BENEFIT_ASSESSMENT
  CASE_REVIEW --> MISSING_INFO
  BENEFIT_ASSESSMENT --> CALCULATION_REVIEW
  CALCULATION_REVIEW --> APPROVAL
  CALCULATION_REVIEW --> BENEFIT_ASSESSMENT
  APPROVAL --> PENSIONER_ENROLMENT
  PENSIONER_ENROLMENT --> PAYMENT_PREPARATION
  PAYMENT_PREPARATION --> PAYMENT_AUTHORIZATION
  PAYMENT_AUTHORIZATION --> DISBURSEMENT
  DISBURSEMENT --> CLOSED
  CLOSED --> [*]
```

### 28.4 Payment dual-control flow

```mermaid
flowchart TD
  P1[ACTIVE Pensioners] --> P2[Finance: Prepare Schedule]
  P2 --> P3[Schedule DRAFT + Items]
  P3 --> P4[Finance / Reviewer: Submit for review]
  P4 --> P5[Payment Authorizer: Authorize]
  P5 --> P6[Disburse via Bank]
  P6 --> P7[Reconciliation Officer: Match bank return]
  P7 --> P8[Schedule RECONCILED]
  P3 --> A1[Open Arrear if months missing]
  A1 --> A2[Approve Arrear]
  A2 --> P2
```

### 28.5 ASCII — full system at a glance

```
                    ┌──────────────────────┐
                    │  Organizations/Users │
                    │  Pension Rule Sets   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      EMPLOYEE        │
                    │  + service history   │
                    │  + salary history    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
           ┌───────│   RETIREMENT CASE    │───────┐
           │       │  stages + timeline   │       │
           │       └──────────┬───────────┘       │
           ▼                  │                   ▼
    ┌─────────────┐           │          ┌────────────────┐
    │  Documents  │           │          │ Benefit Assess │
    │  (uploads)  │           │          │ ← Rule Engine  │
    └─────────────┘           │          └───────┬────────┘
                              │                  │ approve
                              ▼                  ▼
                    ┌──────────────────────┐
                    │      PENSIONER       │◄──────── Verification
                    └──────────┬───────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌────────────┐      ┌────────────┐      ┌────────────┐
    │  Payments  │─────►│ Reconcile  │      │ Complaints │
    │  + Arrears │      └────────────┘      └─────┬──────┘
    └─────┬──────┘                                │
          │                                       │
          └──────────────┬────────────────────────┘
                         ▼
              ┌─────────────────────┐
              │  PENSIONER PORTAL   │
              │  + Notifications    │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ Reports / Audit Log │
              └─────────────────────┘
```

### 28.6 How to read these diagrams

| Diagram | Use it to understand… |
|---------|------------------------|
| **28.1** | Full lifecycle from hiring data to paid pension |
| **28.2** | Which modules feed which (integration map) |
| **28.3** | Legal/operational path of a single retirement file |
| **28.4** | Why two officers are needed before money moves |
| **28.5** | One-page picture for training and workshops |

Data always flows **left-to-right / top-to-bottom** from registry → case → award → payee → payroll. Reports and audit **observe** that chain; they do not create a second set of books.

---

## Licence and ownership

Built for **Kogi State civil service pension administration**. Configuration of official calculation parameters, circulars, and legal instruments remains the responsibility of the authorised State institutions. Software defaults and demo factors must not be treated as statutory entitlement rules.

---

*KSCSPMS — documentation for implementers and operators.*
