# Frontend deployment

The frontend is a Next.js static export deployed to Firebase Hosting. The API is hosted on Render.

Build from the repository root:

```bash
npm ci
npm run build --workspace @fantasy-cricket/web
```

The generated site is `apps/web/out`, matching `firebase.json`.

Set the browser-safe environment variables listed in `.env.example` when building. The GitHub Actions workflow in `.github/workflows/firebase-hosting.yml` injects them from GitHub Actions Secrets and deploys to Firebase Hosting.
