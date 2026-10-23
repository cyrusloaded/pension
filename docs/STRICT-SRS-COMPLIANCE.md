# Strict SRS compliance rules (enforced in code)

The system **rejects** actions that violate the Civil Service Pension requirements.

## Payment schedules

1. New schedules start at `workflowStage = PREPARATION`.
2. **Process** moves PREPARATION → `INTERNAL_AUDIT`.
3. **Assessment / pay** only when stage is `DFA_PAYMENT` (after Internal Audit + DG approval).
4. Separation of duties: preparer cannot complete audit or DG approval on the same schedule.
5. Monthly prepare/import **excludes** non-ACTIVE, NEW_PLACEMENT, DECEASED, SUSPENDED (BR-08).
6. Import **blocks** rows already **PAID** for the same period (BR-11).
7. Successful pay sets stage `COMPLETED` and items `PAID` only on confirmed success (BR-07).

## Required path

```
Import/Prepare (PREPARATION)
  → Process / submit (INTERNAL_AUDIT)
  → Auditor advances (DG_APPROVAL)  [not preparer]
  → DG advances (DFA_PAYMENT)       [not preparer]
  → DFA generates assessment + pays
  → COMPLETED
```

Any attempt to generate assessment or pay earlier returns **HTTP 400** with an SRS reason.

## Gratuity

- Outstanding = approved − **PAID** installments only.
- Propose blocked if amount > outstanding.

## Placements

- Pending pensioners get a placement record; activation required for ordinary payroll.
