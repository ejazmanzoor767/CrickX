# CrickX deployment map

## CRX contest variables

| Variable | Firebase frontend | Render API | Contract deployment |
|---|---|---|---|
| CRX_CONTEST_POOL_ADDRESS | NEXT_PUBLIC_CRX_CONTEST_POOL_ADDRESS | CRX_CONTEST_POOL_ADDRESS | Output of deployment |
| CRX_TOKEN_ADDRESS | NEXT_PUBLIC_CRX_TOKEN_ADDRESS | CRX_TOKEN_ADDRESS | Existing CRX ERC-20 contract |
| POLYGON_RPC_URL | NEXT_PUBLIC_POLYGON_RPC_URL | POLYGON_RPC_URL | POLYGON_RPC_URL |
| CRX_CONTEST_OWNER_PRIVATE_KEY | NEVER | API settlement/owner wallet only | Same wallet as contract owner |
| FUNDING_WALLET | NEVER | Not a secret in API; configured in deployed pool | Company/treasury wallet that owns the CRX prize inventory |

The deployed pool contract owner is the deployer. Render CRX_CONTEST_OWNER_PRIVATE_KEY must correspond to that owner wallet.

The pool fundingWallet is the treasury wallet from which the contract pulls 10 CRX for each participant at join time. For the simplest deployment, make the funding wallet the same wallet as the contract owner. If you use a different funding wallet, that wallet must approve the pool contract to spend CRX before users can join.

## RapidGateway subscription variables

| Variable | Where it goes |
|---|---|
| RAPIDGATEWAY_BASE_URL | Render API |
| RAPIDGATEWAY_ENVIRONMENT | Render API (LIVE) |
| RAPIDGATEWAY_MERCHANT_ID | Render API secret |
| RAPIDGATEWAY_MERCHANT_NAME | Render API (CrickX) |
| RAPIDGATEWAY_CLIENT_SECRET | Render API secret |
| RAPIDGATEWAY_WEBHOOK_SECRET | Render API secret |
| CRICKX_WEB_URL | Render API (https://crickx-3d806.web.app) |

Register the RapidGateway LIVE webhook as:

    https://YOUR-CRICKX-API-DOMAIN/api/v1/subscription/webhook

The frontend never receives the RapidGateway client secret, webhook secret or OAuth access token.

## Subscription

The subscription is 50 PKR for 7 days. Contest joining is free while the subscription is active. The current integration uses a new RapidGateway checkout for each weekly renewal; the supplied RapidGateway documentation does not define an automatic recurring mandate flow, so CrickX does not assume that RECURRING_TXN creates an automatic weekly charge.

## Contest prize funding

Joining a contest does not charge the participant's wallet. The application records the participant and displays a projected pool of 10 CRX × participants.

When final rankings are ready, the backend submits every ranked participant wallet to CRXContestPool. The contract pulls the required CRX from fundingWallet, records the ranking and distributes 100% of the pool to all ranked wallets.

The current default payout formula is rank-weighted: rank 1 receives the largest share, rank N receives the smallest share, and the final participant receives any rounding remainder so the pool reaches exactly zero.

## Render

Use the repository root as the Render service root, or import render.yaml. Add the production secrets in Render Dashboard → your service → Environment.

API health endpoint: /api/v1/health.

## Firebase Hosting

The web app is published through the existing Firebase Hosting GitHub Actions workflow. The frontend needs only the public NEXT_PUBLIC_* variables.

## Local contract deployment

Create contracts/.env locally (this file is ignored by Git):

~~~env
POLYGON_RPC_URL=https://polygon-rpc.com
DEPLOYER_PRIVATE_KEY=YOUR_OWNER_WALLET_PRIVATE_KEY
CRX_TOKEN_ADDRESS=YOUR_CRX_TOKEN_CONTRACT_ADDRESS
FUNDING_WALLET=YOUR_COMPANY_OR_TREASURY_WALLET
~~~

Then run:

~~~bash
cd contracts
npm install
npm run compile
npm run deploy:polygon
~~~

The deployment script prints the new CRXContestPool address. Put that address into Render as CRX_CONTEST_POOL_ADDRESS and into the Firebase GitHub secret NEXT_PUBLIC_CRX_CONTEST_POOL_ADDRESS.

After deployment, the funding wallet must hold enough CRX and approve the new pool contract to pull prize funding. Never put the funding wallet private key in the frontend.

## Security

Never commit .env, private keys, Firebase Admin credentials, RapidGateway secrets, or Render secrets. The browser only receives variables prefixed with NEXT_PUBLIC_.