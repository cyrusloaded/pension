# Compatibility Report: Existing KSCSPMS vs Civil Service Pension SRS

**Date:** 2026-10-22  
**Purpose:** State what already meets the new requirements, what partially meets them, and what must be redeveloped before the system is considered SRS-compliant.

---

## 1. Executive summary

| Rating | Meaning | Count (approx.) |
|--------|---------|-----------------|
| **MEETS** | Implemented and usable | ~45% |
| **PARTIAL** | Structure exists; rules/UI incomplete | ~35% |
| **GAP** | Missing or not aligned with SRS | ~20% |

The existing platform is a solid **foundation** (pensioner registry, RBAC, retirement cases, schedules, import, portal, audit). It does **not** fully implement the government four-stage payment chain, gratuity ledger discipline, placement history, or separation-of-duties as specified in the transcripts. Redevelopment focuses on those gaps rather than discarding the whole codebase.

---

## 2. System objectives (SRS §1)

| # | Objective | Status | Evidence / gap |
|---|-----------|--------|----------------|
| 1 | Central database of pensioners | **MEETS** | `Pensioner`, `Employee`, orgs |
| 2 | Track newly retired not yet on payroll | **PARTIAL** | `PlacementRecord` + page exist; enrolment flow does not always create placement rows |
| 3 | Monthly pension separate from gratuity | **PARTIAL** | Schedules for monthly; gratuity ledger models exist; UI/process still mixed with benefit assessment |
| 4 | Payment history, balances, partial payments | **PARTIAL** | Items + arrears; gratuity outstanding calc exists; not fully driven in all UIs |
| 5 | Automate list → audit → approval → finance | **PARTIAL** | `workflowStage` + API; schedule UI still shows legacy statuses more than 4 stages |
| 6 | Separate logins and permissions | **MEETS** | Users, roles, session permissions, filtered sidebar |
| 7 | Prevent duplicate / over-balance payments | **PARTIAL** | Gratuity BR-05; monthly duplicate period check; no full cross-system duplicate engine |
| 8 | Integrate existing DB + gateways | **PARTIAL** | Gateway demo + assessment; no live legacy API adapter |
| 9 | Upload schedules instead of re-keying | **MEETS** | Excel/CSV import + template |
| 10 | Pensioner self-service portal | **MEETS** | `/portal` payments, complaints, profile |

---

## 3. Core modules (SRS §2)

| Module | Status | Notes |
|--------|--------|-------|
| Pensioner records & registration | **MEETS** | Registry, docs metadata, bank fields |
| New placements & payroll transition | **PARTIAL** | Models + admin list; activation API; not wired into retirement enrolment automatically |
| Gratuity management | **PARTIAL** | Ledger models + outstanding formula; installment confirm API; limited UX for propose/pay |
| Monthly pension payments | **MEETS** | Prepare, import, review, process, assessment, items |
| Approval & workflow | **PARTIAL** | Gov stages in API; dual control; SoD checks; DG/DFA roles not named in seed |
| Document management | **PARTIAL** | Upload/validation/storage; hybrid physical-file model exists, little UI |
| External office hybrid workflow | **GAP** | `PhysicalFileDispatch` model only |

---

## 4. User roles (SRS §3)

| SRS role | Status | Mapping in current system |
|----------|--------|---------------------------|
| System Administrator | **MEETS** | `SUPER_ADMIN` / `SYSTEM_ADMIN` |
| HR / Establishment | **MEETS** | `HR_OFFICER`, `MDA_RECORDS` |
| Pension Records Officer | **PARTIAL** | `PENSION_ADMIN` / records roles |
| Schedule Preparation / DG's Office | **PARTIAL** | `FINANCE_OFFICER` + prepare permission; no dedicated DG role code |
| Internal Auditor | **PARTIAL** | `INTERNAL_AUDITOR`; needs `schedule.audit` granted in seed |
| DG / Authorized Approver | **PARTIAL** | `APPROVAL_OFFICER` + `schedule.dg_approve` |
| DFA | **PARTIAL** | `PAYMENT_AUTHORIZER` / finance + `schedule.dfa_pay` |
| Cashier / Accounts | **GAP** | No distinct cashier role |
| External Government Office | **GAP** | No scoped external-office role |
| Pensioner / Next of Kin | **PARTIAL** | `PENSIONER` portal; NOK claims model only |

**SoD rule (“must not approve own schedule”):** **PARTIAL** — enforced in workflow API for audit/DG; not visible on all UI paths.

---

## 5. Workflows (SRS §4)

| Workflow | Status | Gap |
|----------|--------|-----|
| A — New pensioner placement | **PARTIAL** | Manual placement page; not auto-created on retirement close |
| B — Gratuity payment (4 stages) | **PARTIAL** | Stages on `PaymentSchedule`; gratuity installments separate; not one unified gratuity schedule UX |
| C — Monthly pension payment | **MEETS** (core) | Import/match/flag inactive; 4-stage API secondary to legacy status machine |
| D — External / physical file | **GAP** | Model only |

---

## 6. Business rules (SRS §5)

| ID | Status | Implementation |
|----|--------|----------------|
| BR-01 Unique pension number | **MEETS** | Unique constraint |
| BR-02 Pension ≠ gratuity tracking | **PARTIAL** | Separate models; processes not fully isolated in UI |
| BR-03 Placement history retained | **MEETS** | Placement rows kept on activation |
| BR-04 Outstanding gratuity formula | **MEETS** | `outstandingGratuity()` uses PAID only |
| BR-05 Proposed ≤ balance | **MEETS** | Installment POST |
| BR-06 Stages before payment | **PARTIAL** | API; payment assessment path can still short-circuit |
| BR-07 Confirmed before success | **PARTIAL** | Gateway demo marks paid; production must use provider callback |
| BR-08 Inactive/deceased blocked | **MEETS** | `isEligibleForMonthlyPension` on prepare |
| BR-09 NOK claims separate | **GAP** | Model only |
| BR-10 Amendment history | **MEETS** | Audit log |
| BR-11 Historical duplicate check | **GAP** | No external transaction ID reconciliation |
| BR-12 Failed ≠ confirmed | **MEETS** | Outstanding ignores non-PAID |
| BR-13 Physical + digital same workflow | **GAP** | Model only |
| BR-14 Batch reconciles to lines | **PARTIAL** | Totals maintained; strict recon report limited |

---

## 7. Lifecycle statuses (SRS §6)

| Status | Status | Notes |
|--------|--------|-------|
| Serving civil servant | **MEETS** | `Employee` ACTIVE |
| Retired — new placement | **PARTIAL** | `placementStatus` / placement records |
| Active pensioner | **MEETS** | `paymentStatus=ACTIVE` |
| Inactive / deceased / suspended | **PARTIAL** | Fields exist; death confirmation UI limited |

---

## 8. Dashboards & reports (SRS §8)

| Requirement | Status |
|-------------|--------|
| Role-specific dashboards | **PARTIAL** — one admin dashboard; sidebar filtered by role |
| New placements count | **GAP** on dashboard cards |
| Outstanding gratuity aggregate | **GAP** on dashboard |
| Awaiting approval by stage | **PARTIAL** |
| Export CSV/PDF | **PARTIAL** — CSV on some reports |
| Deceased/inactive report | **GAP** dedicated report |
| NOK claims report | **GAP** |

---

## 9. Non-functional (SRS §10)

| Area | Status |
|------|--------|
| RBAC / audit | **MEETS** |
| Session security | **MEETS** (needs MFA for production) |
| Reliability of money movement | **PARTIAL** (demo gateway) |
| Backup/DR | **GAP** (ops procedure, not app) |
| Compliance / NDPR | **PARTIAL** (policy, not fully engineered) |

---

## 10. Acceptance criteria (SRS §11) — readiness

| AT | Ready? |
|----|--------|
| AT-01 Registration | Yes |
| AT-02 Historical placement | Yes (if placements used) |
| AT-03 Gratuity calculation | Yes (ledger) |
| AT-04 Monthly history | Yes |
| AT-05 Approval workflow | Partial |
| AT-06 Duplicate prevention | Partial |
| AT-07 Deceased block | Yes (if status set) |
| AT-08 Reconciliation | Partial |
| AT-09 External office | No |
| AT-10 Audit trail | Yes |
| AT-11 Historical migration | No |
| AT-12 Access control | Yes (with permission matrix) |

---

## 11. Redevelopment priority

1. **Unify payment schedule UX** on the four-stage government workflow (not only legacy status).  
2. **Wire placement creation** when a retiree is enrolled.  
3. **Complete gratuity UX** (create entitlement from assessment, propose/confirm installments).  
4. **Dashboard SRS KPIs** (placements, outstanding gratuity, queues by stage).  
5. **Seed roles/permissions** for Internal Audit, DG, DFA explicitly.  
6. **NOK + physical file** minimal admin screens.  
7. Keep existing modules (employees, portal, import, RBAC) — do not rewrite from zero.

---

## 12. Conclusion

**Compatibility:** The existing system **partially meets** the SRS. It is suitable as the codebase base.  

**Not a full rewrite from scratch:** Redevelop **workflow, placements, gratuity ledger, role matrix, and dashboards** to match the transcript model, while retaining registry, auth, import, portal, and audit.
