# KSCSPMS alignment with Civil Service Pension SRS

Maps the System Requirements Specification to the implemented platform.

## Objectives covered

| Objective | Implementation |
|-----------|----------------|
| Central pensioner database | Pensioner, Employee, unique pensionerNumber (BR-01) |
| New placements not yet on payroll | PlacementRecord + placementStatus=NEW_PLACEMENT |
| Monthly pension separate from gratuity | paymentType on schedules; GratuityEntitlement ledger |
| Payment history and balances | Schedule items, gratuity installments, arrears |
| Four-stage admin workflow | workflowStage: PREPARATION → INTERNAL_AUDIT → DG_APPROVAL → DFA_PAYMENT → COMPLETED |
| Separate logins / RBAC | Roles, permissions, filtered sidebar |
| No overpayment of gratuity | BR-05 in installment API |
| Upload schedules | Excel/CSV import + template |
| Pensioner portal | /portal/* |

## Business rules

| ID | Rule | Behaviour |
|----|------|-----------|
| BR-01 | Unique pension number | DB unique |
| BR-02 | Pension vs gratuity separate | Monthly vs GratuityEntitlement |
| BR-03 | Keep placement history | Rows retained after activation |
| BR-04 | Outstanding = approved − paid | outstandingGratuity() |
| BR-05 | Proposed ≤ outstanding | canProposeGratuityPayment() |
| BR-06 | Stages before payment | Gov workflow API |
| BR-07 | Confirmed only | Only PAID installments reduce balance |
| BR-08 | Deceased/inactive blocked | isEligibleForMonthlyPension() |
| BR-10 | Audit history | writeAuditLog |
| BR-12 | Failed ≠ confirmed | Non-PAID ignored in outstanding |

## Four-stage payment workflow

Prepare → Internal Audit → DG Approval → DFA Payment → Completed

Separation of duties: preparer cannot audit or DG-approve the same schedule.

## Apply locally

```bash
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```
