# CrickX Contest Workflow

CrickX uses one deployed CRXContestPool contract that manages one contest per Sportmonks fixture. The application allows unlimited participant capacity.

## Subscription and entry flow

1. User logs in.
2. User opens the Weekly Subscription page.
3. User pays 50 PKR through the RapidGateway hosted checkout.
4. RapidGateway sends a signed transaction.completed webhook to the CrickX API.
5. CrickX verifies the webhook signature and activates the subscription for 7 days.
6. User creates or saves a fantasy XI for a fixture.
7. User selects the single contest for that fixture.
8. The backend requires an active subscription and verifies the match has not started.
9. The user connects MetaMask on Polygon and signs a short, contest-specific message proving control of the intended payout wallet.
10. No CRX is deducted from the participant. MetaMask is used only to sign a wallet-ownership message.
11. The backend owner wallet calls the pool contract to fund exactly 10 CRX for the participant.
12. The backend then creates the contest entry and increases the participant count.
13. The on-chain pool and the displayed pool become participantCount × 10 CRX.

## Prize settlement

1. Sportmonks scoring produces the final fantasy ranking.
2. Every joined participant is included in the ranking; there is no top-30% winner cutoff.
3. The backend sends the complete ordered wallet list to CRXContestPool.
4. The contract pulls 10 CRX × participantCount from its configured fundingWallet.
5. The contract stores the final ranking.
6. The contract distributes the entire pool to every ranked participant. The current default weighting is rank 1 through rank N with weights N through 1; the final rank receives the rounding remainder.
7. The backend records each participant's rank and prize and marks the contest completed only after the contract reaches Distributed.

## On-chain model

- CRX_TOKEN_ADDRESS identifies the ERC-20 token being paid.
- CRX_CONTEST_POOL_ADDRESS identifies the contract that holds and distributes the prize pool.
- fundingWallet is the treasury/company wallet that supplies prize CRX.
- The contract owner is the backend settlement/deployment wallet.
- Winner wallets are the participant wallet addresses in the final ranking.
- The participant does not pay CRX to join.

## Important wallet distinction

The token contract address is not the wallet that pays prizes. It only identifies the CRX token contract.

The funding wallet owns the CRX inventory used for prizes. The pool contract receives those tokens with transferFrom(fundingWallet, pool, amount) after the funding wallet has approved the pool. Winners then receive CRX with transfer(winner, amount) from the pool contract's own balance.

## Deployment

Deploy CRXContestPool once with:

~~~bash
cd contracts
npm install
npm run compile
npm run deploy:polygon
~~~

Constructor:

~~~solidity
constructor(address crxTokenAddress, address fundingWallet)
~~~

Do not deploy the new pool over the old one. After deployment, update both API and frontend pool-address configuration to the new contract. The API also handles old Firestore contest records whose stored chain ID no longer exists on the configured new pool by creating a fresh on-chain contest before a new participant joins.