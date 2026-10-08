# CrickX backend — Firebase Firestore + Cloud Run

## Architecture

- Firebase Hosting: Next.js frontend (`https://crickx-3d806.web.app`)
- Cloud Run: existing NestJS API (`crickx-api`)
- Firestore: application database
- Sportmonks: source of cricket/fixture/player/live-score data
- Razorpay/RazorpayX: disabled for now

## 1. Create Firestore

In Firebase Console, select project `crickx-3d806` → Build → Firestore Database → Create database.
Choose a production database. Pick the desired database location carefully; Firestore location cannot be changed after creation.

The repository contains restrictive `firestore.rules`: browser clients are denied direct Firestore access. The NestJS API uses the Admin SDK and therefore does not depend on client Firestore rules.

## 2. Install Google Cloud CLI

Install the current Google Cloud CLI on Windows, then:

```powershell
gcloud auth login
gcloud config set project crickx-3d806
gcloud auth application-default login
```

For local development, the Firestore Admin SDK uses Application Default Credentials. On Cloud Run, Google recommends Application Default Credentials and the runtime service account provides the credentials automatically.

## 3. Enable services

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com
```

## 4. Deploy the API

From the repository root:

```powershell
gcloud run deploy crickx-api --source . --region us-east1 --allow-unauthenticated
```

If prompted to enable APIs or create the Artifact Registry repository, answer `Y`.

Record the resulting Cloud Run service URL.

## 5. Cloud Run variables

Set these in Cloud Run → `crickx-api` → Edit and deploy new revision → Variables & Secrets:

```text
GOOGLE_CLOUD_PROJECT=crickx-3d806
SPORTMONKS_BASE_URL=https://cricket.sportmonks.com/api/v2.0
SPORTMONKS_API_TOKEN=<real Sportmonks token>
SPORTMONKS_HOURLY_LIMIT=3000
JWT_ACCESS_SECRET=<random secret>
JWT_REFRESH_SECRET=<different random secret>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
ALLOWED_SPORTMONKS_LEAGUE_IDS=<comma-separated league IDs covered by your plan>
CORS_ORIGIN=https://crickx-3d806.web.app

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAYX_KEY_ID=
RAZORPAYX_KEY_SECRET=
RAZORPAYX_ACCOUNT_NUMBER=
```

Do not add `DATABASE_URL`: the runtime database is Firestore.
Do not upload a Firebase service-account JSON file to GitHub. On Cloud Run, Application Default Credentials are the recommended authentication mechanism.

## 6. Seed application data

The source contains `apps/api/prisma/seed.ts` only as a historical path name; it no longer imports Prisma. It writes the default scoring rules and optional bootstrap super-admin into Firestore.

From a trusted local environment after `gcloud auth application-default login`:

```powershell
$env:GOOGLE_CLOUD_PROJECT='crickx-3d806'
$env:SEED_ADMIN_EMAIL='your-admin-email'
$env:SEED_ADMIN_PASSWORD='your-strong-admin-password'
npm install
npm run firestore:seed --workspace @fantasy-cricket/api
```

Remove `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` after bootstrap. Do not commit them.

## 7. Firestore data model

Collections used by the API:

`users`, `profiles`, `wallets`, `refreshTokens`, `authAuditLogs`, `kycRecords`, `transactions`, `deposits`, `withdrawals`, `scoringRuleSets`, `contests`, `contestEntries`, `fantasyTeams`, `fantasyTeamPlayers`, `fantasyTeamEditHistory`, `leaderboardSnapshots`, `playerFixtureCredits`, `cachedFixtures`, `cachedPlayers`.

Cricket fixtures, players, teams and live scores remain Sportmonks-owned data. Firestore stores application data plus short-TTL cache records.

## 8. Connect Hosting to Cloud Run

`firebase.json` already rewrites `/api/**` to Cloud Run service `crickx-api` in `us-east1`.

The production frontend API base is `/api/v1`, so browser requests use:

`https://crickx-3d806.web.app/api/v1/...`

and Firebase Hosting forwards them to Cloud Run.

Deploy Hosting after the frontend has been built:

```powershell
firebase use crickx-3d806
firebase deploy --only hosting
```

## 9. Verify

1. Cloud Run revision is serving 100% traffic.
2. Firebase Hosting is deployed.
3. Open `https://crickx-3d806.web.app`.
4. Test registration/login.
5. Test the matches screen; the API should obtain cricket data from Sportmonks.
6. Confirm user/profile/wallet documents appear in Firestore.

## Important security note

The Admin SDK bypasses Firestore security rules, so all application authorization must continue to be enforced by the NestJS API. Keep the service account identity limited to the required project access and never expose private credentials in the frontend.
