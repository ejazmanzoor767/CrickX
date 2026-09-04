# Fantasy Cricket

Real-money-style fantasy cricket platform. Cricket data (fixtures, teams, players,
scores, stats, ball-by-ball) is always live from **Sportmonks Cricket API v2.0** —
see `apps/api/src/modules/sportmonks`. Application data (users, wallet, fantasy
teams, contests) lives in Postgres — see `apps/api/prisma/schema.prisma`.

Full architecture and design rationale: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Layout
```
apps/api/      NestJS backend — the only thing that talks to Sportmonks
apps/web/      Next.js web app (Matches / Fantasy / Wallet / Profile)
apps/mobile/   Expo/React Native app (same 4 sections)
packages/shared/  Shared TS types used by web + mobile
```

## Getting started

### 1. Backend
```
cd apps/api
cp .env.example .env      # fill in DATABASE_URL, SPORTMONKS_API_TOKEN, JWT secrets
npm install
npm run prisma:migrate    # creates tables from schema.prisma
npm run start:dev         # http://localhost:4000/api/v1
```
Set `ALLOWED_SPORTMONKS_LEAGUE_IDS` in `.env` to the league IDs your Sportmonks
plan actually covers — the Matches module filters to these so users never hit
a 403 on a fixture your token can't reach.

Admins must seed at least one `ScoringRuleSet` and, per contest, `PlayerFixtureCredit`
rows (fantasy "credit" pricing is not something Sportmonks provides — see
`prisma/scoring-seed.sql` for a starting example) before a contest can be created
or a fantasy team built for it.

### 2. Web
```
cd apps/web
cp .env.example .env.local
npm install
npm run dev                # http://localhost:3000
```

### 3. Mobile
```
cd apps/mobile
cp .env.example .env
npm install
npx expo start
```

## What's implemented
- Auth: register/login/refresh-rotation/logout (bcrypt + JWT, audit log)
- Matches: live fixture list, live polling, detail — 100% Sportmonks-sourced
- Fantasy: team builder validated against the real Sportmonks-announced lineup
  (11 unique players, credit cap, max-per-real-team, captain/VC), contests,
  joining (atomic wallet debit), leaderboard
- Scoring: cron-polls live contests every 30s, computes points from Sportmonks
  batting/bowling/dismissal data against an admin-defined `ScoringRuleSet`,
  ranks entries, settles payouts on `Finished` status
- Wallet: idempotent ledger (deposit/winnings/bonus buckets), deposits,
  withdrawals, transaction history
- Profile: profile CRUD, KYC submission stub
- Web + mobile clients for all four sections, calling only our own API

- Razorpay payments: order creation (`POST /wallet/deposits`), signature-verified
  webhook confirmation (`POST /webhooks/razorpay`, the trusted path) plus a
  client-checkout fallback confirm endpoint that re-verifies the signature
  server-side. See `apps/api/src/modules/wallet/razorpay.service.ts`.
- Admin console: dashboard, player-credit pricing (validated against the real
  Sportmonks lineup), scoring rule-set management, KYC review, withdrawal
  review — backend under `modules/admin`, web UI under `apps/web/src/app/admin`.
  Gated by `RolesGuard` (`ADMIN`/`SUPER_ADMIN`).
- Fixture-sync scheduler: pre-warms the Sportmonks cache every 5 minutes for
  fixtures starting within 24h so the team-builder loads instantly.

## Razorpay setup
1. Get `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` from the Razorpay dashboard, put in `apps/api/.env`.
2. In the dashboard, add a webhook: URL `https://your-api/api/v1/webhooks/razorpay`, events `payment.captured` + `payment.failed`, copy the signing secret into `RAZORPAY_WEBHOOK_SECRET`.
3. Frontend flow: `POST /wallet/deposits` → open Razorpay Checkout with the returned `razorpayOrder` → on success, either wait for the webhook (recommended) or call `POST /wallet/deposits/confirm` with the checkout's `razorpay_payment_id`/`razorpay_order_id`/`razorpay_signature` as a fallback.

## What's next
- `PayoutService` (RazorpayX) exists and is wired into the module but not yet called from `AdminService.reviewWithdrawal` — bank payouts require a verified "fund account" per user (a separate KYC/bank-verification onboarding flow), which isn't modeled yet. Until then, approving a withdrawal is admin-tracked with a manual payout reference.
- E2E tests (unit tests now cover scoring math, wallet ledger idempotency/locking, and fantasy-team validation — see `npm test` in `apps/api`)
- Production hardening: secrets management, structured logging/observability, rate-limit tuning per endpoint

## Local dev quickstart
```
docker compose up -d          # Postgres
cd apps/api
cp .env.example .env          # fill in SPORTMONKS_API_TOKEN at minimum
npm install
npm run prisma:migrate
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=change_me npm run prisma:seed
npm run start:dev
npm test                      # runs the unit test suite
```
Then log into the web app's `/admin/login` with the seeded admin account.
