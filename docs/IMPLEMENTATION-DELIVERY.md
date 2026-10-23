# KSCSPMS continued implementation delivery

## Newly completed in this pass

- Pensioner **master profile** expanded: service history, placements, payments, NOK, death, audit/activity
- **Death administration** UI + API on existing profile only
- **NOK claim** form on profile + beneficiaries module
- **New placements** URL pagination, search, page size, profile links
- **Import history** page + API (`/admin/import-history`)
- **Export CSV** for register (`/api/intake/export`)
- **Import preview** then confirm (already present; retained)
- **Bank detail change** request/approve API (controlled, audited)
- `/admin/employees` still redirects to intake (terminology)

## Apply

```bash
npx prisma generate
npx prisma db push
npm run dev
```

## Still optional / later

- Native .xlsx generation (CSV works for template/import/export)
- Bank-change dedicated admin queue UI
- Expand pagination on every remaining legacy admin list
- Automated e2e test suite

## Webhooks (this pass)

- `POST /api/payments/webhooks/paystack` — signature via `PAYSTACK_SECRET_KEY`
- `POST /api/payments/webhooks/flutterwave` — `verif-hash` via `FLUTTERWAVE_SECRET_HASH`
- Demo mode when secrets empty and `PAYMENT_GATEWAY_MODE=demo`
- On success: assessment PAID, schedule items PAID, schedule COMPLETED (BR-07)

## E2E

```bash
npx playwright install chromium   # once
npm run test:e2e
npm run test:unit
```
