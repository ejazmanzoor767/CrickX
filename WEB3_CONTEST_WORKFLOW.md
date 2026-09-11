# CrickX Web3 Contest Workflow

CrickX uses one deployed `CRXContestPool` contract that manages **one contest per Sportmonks fixture**. There is no global participant/spot cap. A user can join each fixture contest once per wallet.

## User flow
1. User logs in.
2. User selects a Sportmonks match.
3. User creates/saves a fantasy XI for that fixture. Team creation is free.
4. The app loads the single contest for that fixture; the entry fee is 4 CRX.
5. User connects MetaMask and switches to Polygon.
6. Frontend checks the CRX balance and allowance.
7. User approves the pool to spend 4 CRX when required.
8. MetaMask calls `joinContest(fixtureId)` on `CRXContestPool`.
9. Backend verifies the transaction recipient, sender, function argument, success receipt, deadline, CRX `Transfer` amount and on-chain `hasEntered` state.
10. Backend creates the database `ContestEntry` only after successful verification.
11. Sportmonks live data drives fantasy scoring and leaderboard updates.
12. At/after the match start, entries and team edits are locked.
13. After final scoring, the backend ranks all entries and sends the top 30% wallet addresses to the contract.
14. The owner locks the contest, sets the equal winner prize table, finalizes ranking and distributes prizes.

## On-chain model
- One pool contract deployment for the application.
- Each Sportmonks fixture id is the on-chain `contestId`.
- The same contract can hold many historical/future fixture contests.
- Each contest has its own `entryFee`, `joinDeadline`, `stage`, participant count, pool and winner ranking.
- Entry fee is configured per contest by the backend; CrickX currently creates contests at 4 CRX.
- Participant storage is O(1) per wallet; no array of all entrants is required.
- Payouts use the top 30% of entrants. The contract assigns 90% of the pool to winners and 10% to the company wallet.

## Deployment
Deploy `CRXContestPool` once with the CRX token and company wallet:

```bash
cd contracts
npm install
npm run compile
npm run deploy:polygon
```

The deployment prints the pool address. Put it into Render as `CRX_CONTEST_POOL_ADDRESS` and into the frontend as `NEXT_PUBLIC_CRX_CONTEST_POOL_ADDRESS`.

Do **not** put a contest deadline in `contracts/.env`; match-specific deadlines are created on-chain from the Sportmonks fixture start time when each contest is created.
