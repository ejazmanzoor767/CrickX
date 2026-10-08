# CrickX Firebase frontend deployment

This repository uses classic Firebase Hosting for the exported Next.js frontend (`apps/web/out`).

## GitHub secrets required

Set these in GitHub → Settings → Secrets and variables → Actions:

- `FIREBASE_SERVICE_ACCOUNT` — Firebase deploy service-account JSON used by the GitHub Action.
- `FIREBASE_PROJECT_ID` — `crickx-3d806`.
- `NEXT_PUBLIC_API_BASE_URL` — your Render API URL, e.g. `https://pitchxi-secure.onrender.com/api/v1`.
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_POLYGON_RPC_URL`
- `NEXT_PUBLIC_CRX_TOKEN_ADDRESS`
- `NEXT_PUBLIC_CRX_CONTEST_POOL_ADDRESS`

Never add `CRX_CONTEST_OWNER_PRIVATE_KEY` to GitHub Actions or the Firebase frontend.

A push to `main` builds `apps/web/out` and deploys it to Firebase Hosting.
