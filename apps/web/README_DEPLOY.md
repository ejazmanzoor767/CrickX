# Frontend deployment

Backend API: https://pitchxi-secure.onrender.com/api/v1

This app is intended for Firebase App Hosting (Next.js server rendering), not static Firebase Hosting, because the match pages fetch live API data on the server.

## Firebase App Hosting

Connect the GitHub repository/branch containing this project in Firebase App Hosting and set the app root directory to `apps/web` if prompted.

`apphosting.yaml` supplies `NEXT_PUBLIC_API_BASE_URL` for build/runtime.
