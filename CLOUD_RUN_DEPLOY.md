# CrickX backend — Firebase Hosting + Cloud Run

## Architecture
- Frontend: Firebase Hosting (`crickx-3d806.web.app`)
- Backend: Google Cloud Run (`crickx-api`)
- Database: existing PostgreSQL
- Cricket data: Sportmonks

## 1. Authenticate Google Cloud
```powershell
gcloud auth login
gcloud config set project crickx-3d806
```

## 2. Deploy backend from the repository root
```powershell
cd C:\Users\User\Downloads\fantasy-cricket-firebase-ready
gcloud run deploy crickx-api --source . --region us-east1 --allow-unauthenticated
```

When prompted, enable required APIs and create the Artifact Registry repository.

## 3. Set Cloud Run environment variables
In Cloud Run -> crickx-api -> Edit & deploy new revision -> Variables & Secrets, add:
- DATABASE_URL
- SPORTMONKS_BASE_URL
- SPORTMONKS_API_TOKEN
- SPORTMONKS_HOURLY_LIMIT
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- JWT_ACCESS_TTL
- JWT_REFRESH_TTL
- ALLOWED_SPORTMONKS_LEAGUE_IDS
- CORS_ORIGIN = https://crickx-3d806.web.app

Leave Razorpay/RazorpayX variables empty for now.

Do not commit `.env` or real secrets to GitHub.

## 4. Rebuild frontend
```powershell
cd apps\web
npm install
npm run build
```
The static site will be generated in `apps/web/out`.

## 5. Deploy Firebase Hosting rewrite + frontend
From repository root:
```powershell
firebase deploy --only hosting
```

## 6. Test
Open:
- `https://crickx-3d806.web.app`
- `https://crickx-3d806.web.app/api/v1/...`

The `/api/**` Hosting rewrite forwards to the Cloud Run service `crickx-api` in `us-east1`.
