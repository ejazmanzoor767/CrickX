# Firebase Hosting (Spark) deployment

This frontend is configured for Next.js static export so it can be deployed with Firebase Hosting on the Spark plan.

## Backend

Production API base URL:

`https://pitchxi-secure.onrender.com/api/v1`

## Local build

From the repository root:

```bash
npm install
npm run web:build
```

The static site is generated at:

`apps/web/out`

## Firebase Hosting

From the repository root:

```bash
firebase login
firebase use crickx-3d806
firebase deploy --only hosting
```

The match list and match detail pages use browser-side API calls because classic Firebase Hosting does not run a Next.js server. Match details are opened with `/matches?fixtureId=<ID>`.
