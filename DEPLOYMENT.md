# CrickX deployment map

## Where the four CRX variables go

| Variable | Firebase frontend | Render API | Local contract deployment |
|---|---|---|---|
| `CRX_CONTEST_POOL_ADDRESS` | `NEXT_PUBLIC_CRX_CONTEST_POOL_ADDRESS` | `CRX_CONTEST_POOL_ADDRESS` | Output of deployment |
| `CRX_TOKEN_ADDRESS` | `NEXT_PUBLIC_CRX_TOKEN_ADDRESS` | `CRX_TOKEN_ADDRESS` | `CRX_TOKEN_ADDRESS` |
| `POLYGON_RPC_URL` | `NEXT_PUBLIC_POLYGON_RPC_URL` | `POLYGON_RPC_URL` | `POLYGON_RPC_URL` |
| `CRX_CONTEST_OWNER_PRIVATE_KEY` | **NEVER** | `CRX_CONTEST_OWNER_PRIVATE_KEY` | same wallet as deployment owner, as `DEPLOYER_PRIVATE_KEY` |

The pool contract's `owner` is the wallet that deploys the contract. Therefore the Render `CRX_CONTEST_OWNER_PRIVATE_KEY` must correspond to the same address used as `DEPLOYER_PRIVATE_KEY` when the pool is deployed.

## Render

Use the repository root as the Render service root, or import `render.yaml`. Render runs the API from the monorepo root. Add the production secrets in Render Dashboard → your service → Environment.

API health endpoint: `/api/v1/health`.

## Firebase Hosting

The web app is a static Next.js export and is published from `apps/web/out`. GitHub Actions builds it on pushes to `main`. See `FIREBASE_DEPLOYMENT.md`.

## Local contract deployment

Create `contracts/.env` locally (this file is ignored by Git):

```env
POLYGON_RPC_URL=https://polygon-rpc.com
DEPLOYER_PRIVATE_KEY=YOUR_OWNER_WALLET_PRIVATE_KEY
CRX_TOKEN_ADDRESS=0x0706508638A6cBaaC482f971326299eCdd2D0731
COMPANY_WALLET=YOUR_COMPANY_WALLET
ENTRY_FEE_CRX=4
```

Then run:

```bash
cd contracts
npm install
npm run compile
npm run deploy:polygon
```

The deployment script prints the new `CRX_CONTEST_POOL_ADDRESS`. Put that address into Render and the Firebase frontend GitHub secret.

## Security

Never commit `.env`, private keys, Firebase Admin credentials, or Render secrets. The browser only receives variables prefixed with `NEXT_PUBLIC_`.
