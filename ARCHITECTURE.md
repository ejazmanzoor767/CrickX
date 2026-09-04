# Fantasy Cricket — Architecture

## Stack
- **API**: NestJS + TypeScript, Prisma ORM, PostgreSQL
- **Web**: Next.js (React), consumes the API only — no direct Sportmonks calls
- **Mobile**: React Native (Expo), same API contract as web
- **Shared**: `packages/shared` — TS types/DTOs and the scoring-rule schema shared by API, web, mobile

## Hard rule: no mock/seeded/fake cricket data
- `apps/api/src/modules/sportmonks/*` is the **only** code allowed to call `cricket.sportmonks.com`.
- `SportmonksDataService` is the only entry point other modules may use — `SportmonksClientService` is not exported from the module on purpose.
- `CachedFixture` / `CachedPlayer` (Prisma) are a short-TTL performance cache, **not** a data source. On cache miss/expiry we always re-fetch from Sportmonks. They are never pre-populated, seeded, or faked — only ever written by `SportmonksDataService` from a live API response.
- Fantasy team players, contests, wallet balances, users — this is all *our* data and lives in Postgres, referencing Sportmonks IDs (`sportmonksFixtureId`, `sportmonksPlayerId`, `sportmonksTeamId`) as foreign keys in spirit, never duplicating names/stats/scores.
- CI should include a lint rule / grep check (`rg "sportmonks" apps/web apps/mobile`) to fail the build if web/mobile ever import Sportmonks types directly instead of going through the API.

## Confirmed Sportmonks Cricket API v2.0 facts driving this design
(from docs.sportmonks.com, verified before writing code)
- Base URL `https://cricket.sportmonks.com/api/v2.0`, auth via `api_token` query param or `Authorization` header, same rate limit either way.
- All cricket plans: 3,000 requests/hour. Plan tier only changes *which leagues* your token can reach, not the response shape or field set.
- `/fixtures` is paginated, supports `filter[...]`, `sort`, `fields[object]`, and up to 10 nested `include`s. `/fixtures/{id}` is not paginated.
- Enrichable includes on a fixture: `localteam`, `visitorteam`, `venue`, `runs`, `batting`, `bowling`, `lineup`, `balls`, `scoreboards`, umpires, referee, toss, man of match/series, stage, season, league.
- `/fixtures/live` returns live-only fixtures; ball-by-ball (`balls`) is where live fantasy scoring deltas come from.
- Status codes: 400 malformed, 401 unauthenticated, 403 plan doesn't cover this resource (**must** be surfaced distinctly — see `SportmonksClientService`), 404 not found (often due to rescheduling), 429 rate limited, 500 upstream error.

## Modules (API)
| Module | Owns | Talks to Sportmonks? |
|---|---|---|
| `sportmonks` | HTTP client, rate limiting, typed fixture/player/team fetchers, cache | Yes (only module that does) |
| `matches` | Exposes fixtures/live/detail to frontend, applies our own filtering (e.g. only leagues in our plan) | No — via `SportmonksDataService` |
| `fantasy` | Team creation/edit, contest CRUD, entries, lineup lock at `starting_at` | No |
| `scoring` | Consumes `balls`/`batting`/`bowling` from Sportmonks + `ScoringRuleSet` to compute fantasy points | No |
| `wallet` | Deposits, withdrawals, transactions, idempotent balance mutations | No |
| `auth` | Users, sessions, refresh tokens, audit log | No |
| `profile` | User profile, KYC | No |

## Not yet built (next steps, in priority order)
1. `auth` module (JWT + refresh token rotation, password hashing, audit log)
2. `matches` module (thin controller wrapping `SportmonksDataService`, league-coverage filtering)
3. `fantasy` module (team builder validation: credits cap, role composition, captain/VC, lineup lock)
4. `scoring` module (maps `balls`/`batting`/`bowling` deltas → `ScoringRuleSet` → live point updates)
5. `wallet` module (idempotent ledger operations, deposit/withdrawal gateway integration)
6. Web app (Next.js) — Matches / Fantasy / Wallet / Profile
7. Mobile app (Expo/React Native) — same four sections
8. Background workers: fixture sync scheduler, live-score poller feeding the scoring engine, contest settlement job

This was scoped as a large build — happy to continue straight into any of the above; auth + matches + fantasy is the natural next slice since scoring and wallet depend on them.
