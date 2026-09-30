# CrickX Whitepaper

**Version 1.1 · September 30, 2026**

**Project:** CrickX  
**Website:** https://crickxfantasy.site  
**Repository:** https://github.com/ejazmanzoor767/CrickX  
**Token:** CRX  
**Network:** Polygon  
**Current CRX contract address:** `0x6A7BeF6Bff1CE03C14D25bC97b1AF7097894b05E`

---

## 1. Executive Summary

CrickX is a fantasy-cricket platform that combines live cricket data, fantasy team building, competition, prediction games, digital payments, and the CRX utility token.

The platform is designed around a simple product loop:

1. A user creates an account and subscribes to CrickX access.
2. The user browses live and upcoming cricket matches.
3. The user builds an XI from eligible players using the platform's fantasy rules.
4. The user joins the match contest without paying CRX to enter.
5. CrickX funds the contest prize pool with CRX on behalf of participants.
6. Live cricket information from Sportmonks feeds fantasy scoring and match status.
7. When a contest is completed, final rankings are calculated and the smart contract distributes the CRX prize pool to participant wallets.
8. Eligible matches can also offer five prediction questions, with CRX prizes based on prediction performance.
9. The Wallet includes a self-custody CRX view, direct CRX transfers, and an Early Buy flow through OxaPay.

CrickX is intended to make fantasy cricket accessible through a web application and an Android application while using blockchain where it provides a clear operational benefit: transparent CRX prize custody and settlement.

This document describes the current product and architecture. It is a product and technical whitepaper, not a promise of future returns or a statement that the platform or smart contracts are risk-free.

---

## 2. Problem

Fantasy cricket users commonly face fragmented experiences:

- live match information is separated from fantasy team management;
- contest and prize information can be difficult to understand;
- payment and wallet flows can require unnecessary steps;
- fantasy applications may rely on opaque off-chain prize accounting;
- prediction games often exist as isolated products rather than part of the match experience.

CrickX is designed as a single match-centered platform where match discovery, fantasy selection, competition, predictions, scoring, rankings, and CRX settlement are connected.

---

## 3. Product Vision

CrickX aims to build a cricket competition layer in which:

- live cricket information is easy to follow;
- fantasy selection is simple and constrained by clear rules;
- users can participate from web or Android;
- contest prize funding is expressed in CRX;
- the prize pool is ultimately held and distributed by an on-chain contract;
- prediction games use a fixed five-question format per match;
- payment, subscription and customer-service flows are handled through normal web payments rather than forcing users to acquire CRX merely to access fantasy features.

The objective is not to replace cricket data providers or blockchain networks. CrickX combines these services into one user-facing application.

---

## 4. Platform Architecture

CrickX uses four principal layers.

### 4.1 Client layer

**Web:** Next.js / React.

**Android:** Expo / React Native shell that loads the CrickX web experience while providing a mobile-specific navigation shell.

The current mobile navigation exposes Matches, Fantasy, Wallet, and Profile.

The clients communicate with the CrickX API rather than calling Sportmonks directly.

### 4.2 Application layer

The backend is implemented in NestJS/TypeScript and contains modules for authentication and sessions, match access, fantasy teams, contest participation, scoring, subscriptions and payment verification, wallet/account records, predictions, referral functionality, and on-chain contest/prediction settlement.

Application data is maintained separately from external cricket data.

### 4.3 Cricket-data layer

Sportmonks Cricket API is the source for fixtures, teams, players, lineups, scores and ball-by-ball information.

CrickX uses the provider data to determine whether a match is upcoming, live or completed; which players are available; live scoring inputs; final match statistics; and prediction outcomes.

A major design rule is that the web and mobile clients do not use Sportmonks credentials directly.

### 4.4 Blockchain layer

Polygon hosts the CRX ERC-20 token and the smart contracts used to hold and distribute contest prize pools.

The blockchain layer is intentionally narrow: it is primarily used for token custody, prize settlement and wallet ownership verification rather than for storing all application data.

---

## 5. CRX Token

CRX is the native utility token used by the CrickX ecosystem.

| Property | Value |
|---|---|
| Token | CrickX |
| Symbol | CRX |
| Standard | ERC-20 |
| Network | Polygon |
| Maximum supply | 500,000,000 CRX |
| Current contract | `0x6A7BeF6Bff1CE03C14D25bC97b1AF7097894b05E` |

The current token contract mints the defined supply during deployment.

CRX is used within CrickX primarily for fantasy contest prize pools, prediction prize pools, and on-platform token utilities where enabled.

CRX should not be interpreted as an equity instrument, ownership share, deposit account or guaranteed-return asset.

---

## 6. Subscription Model

CrickX currently uses a paid subscription to unlock fantasy and prediction participation.

### Weekly

- Price: **$0.18**
- Access period: **7 days**

### Monthly

- Price: **$0.60**
- Access period: **30 days**

The subscription is separate from contest prize funding.

CrickX currently uses OxaPay-hosted checkout and activates a subscription only after the backend receives and verifies the payment provider's successful webhook.

The platform does not require a user to spend CRX to purchase the subscription.

The current customer-facing app displays a token-launch countdown to October 17, 2027. The displayed date is a product schedule and may change.

---

## 7. Fantasy Cricket

Fantasy team creation is the core game experience.

### Team construction

For an eligible match, a user:

1. opens the fantasy match;
2. selects exactly **11 players**;
3. stays within a **100-credit** budget;
4. selects no more than **7 players from one real team**;
5. selects a captain;
6. selects a vice-captain.

The current user interface removes duplicate player rows by player ID so the same player cannot accidentally be selected twice.

### Locking

Fantasy selection locks when the match starts.

Once the match is live:

- new team creation for that fixture is closed;
- saved teams become view-only;
- the user can continue to inspect live information, predictions and rankings.

### Scoring

CrickX calculates fantasy points from cricket data delivered by Sportmonks and the configured CrickX scoring rules.

The current game rules apply:

- captain multiplier: **2×**
- vice-captain multiplier: **1.5×**

The final ranking is based on the resulting fantasy score.

---

## 8. Contest Model

CrickX uses a fixture-based contest model.

Each eligible cricket fixture can have one CrickX contest with an unlimited participant capacity at the application level.

### User entry

The participant does **not** pay CRX to enter the contest.

MetaMask is used to sign a short message proving control of the wallet that should receive a future prize.

The signature does not transfer CRX, does not require token approval, and does not charge the participant a token entry fee.

### Prize funding

CrickX allocates:

**10 CRX per joined participant**

The application records participant accounting and, when the match starts, the backend funds the full contest pool through the treasury/funding wallet and the contest contract.

This design is intended to reduce repeated on-chain transfers during the joining process while keeping final prize custody on-chain.

---

## 9. Contest Smart Contract

CrickX uses a `CRXContestPool` smart contract to manage the contest lifecycle.

The contract stores the CRX token reference, stores the funding wallet, creates fixture contests, records participant counts and the required pool size, records the final ranking, distributes the complete pool, supports cancellation/refund of an unfunded/open contest, and exposes contest summaries and ranking data.

### Pool invariant

For a funded contest, the contract requires:

**total pool = distributed prizes**

The final ranked participant receives the rounding remainder where integer token arithmetic would otherwise leave a small difference.

### Rank-weighted distribution

The current distribution algorithm uses decreasing rank weights:

- rank 1 has the highest weight;
- each following rank has a lower weight;
- every ranked participant can receive a share;
- the final participant receives the rounding remainder.

This means a funded contest is not limited to a top-percent winner cutoff under the current contract design.

---

## 10. Prediction System

CrickX also provides a separate prediction experience attached to cricket fixtures.

Each eligible match has **five prediction questions**.

The current question types include:

1. Match winner
2. Featured bowler — 3 or more wickets
3. Featured batter — 50 or more runs
4. Powerplay score threshold
5. Total match sixes threshold

The featured batter and bowler are selected from the match squad using the platform's player-selection logic.

### Prediction access

An active CrickX subscription is required.

Predictions open before the match, lock when the match goes live, cannot be changed after locking, and are settled after the match result and statistics are available.

### Pool allocation

CrickX allocates **25 CRX per prediction participant** to the prediction pool. The five questions therefore correspond to a 5 CRX allocation per question.

### Qualification and prizes

A participant needs at least **3 correct answers** to qualify for a CRX prize.

The current prize-share model allocates:

- 5 correct: 50% tier
- 4 correct: 30% tier
- 3 correct: 20% tier

Where multiple users are in the same correctness tier, that tier's share is divided among qualifying participants, subject to the final on-chain accounting rules.

---

## 11. Live Match Experience

The Match Centre separates live, upcoming, and completed matches.

The Fantasy area focuses on matches that are still actionable or already live.

CrickX uses normalized backend match state so stale provider flags do not automatically make an upcoming fixture appear live.

This state handling is important for fantasy and prediction locking because the match's application state controls whether users may edit teams or submit predictions.

---

## 12. Wallet and Payment Design

CrickX has two distinct financial concepts.

### Fiat/checkout layer

Subscriptions and other supported paid services can use hosted payment providers such as OxaPay.

The provider confirms payment through a server-side webhook.

### CRX blockchain layer

CRX is held and transferred on Polygon.

The user's MetaMask wallet is used for blockchain identity and prize receipt.

The Wallet section is self-custody oriented: the connected Polygon wallet is used to view the on-chain CRX balance and make direct CRX transfers. CrickX does not hold a user's CRX in an internal account balance.

The current Early Buy flow accepts a minimum of **$1 USD** at the displayed rate of **1 CRX = $0.002** through OxaPay. After verified payment, the backend fulfills the purchased CRX to the connected Polygon wallet.

The separation means a user does not need to make a CRX transfer merely to join an eligible fantasy contest.

---

## 13. Referral System

CrickX includes a referral model in which referral validity can be tied to subscription participation.

The intended purpose is to attribute new users to an existing CrickX referral code and measure valid referral activity.

Referral rewards are not described as guaranteed cash returns. Reward rules may depend on the active program defined by CrickX.

---

## 14. Security Model

Security is built around separation of responsibilities.

### Application security

The backend is responsible for authentication, authorization, session and refresh-token controls, payment webhook verification, database validation, contest validation, wallet-signature verification, rate and state checks, and idempotent financial operations where applicable.

### Key separation

Private credentials are not intended to be exposed to the web or Android clients.

Examples of backend-only secrets include payment-provider credentials, webhook secrets, database credentials, and blockchain settlement/signing keys.

### Blockchain controls

The current contest contract uses an owner-controlled operational model.

The owner can perform administrative actions required to operate the contest lifecycle, including contest creation and settlement operations.

This is an explicit trust assumption: CrickX should therefore be understood as a managed platform using blockchain settlement, not as a fully permissionless DAO.

### Audit status

The current whitepaper does **not** represent the contracts or application as independently security-audited unless a separate public audit report is published.

Users should treat smart-contract, wallet, payment, provider/data and application risks as real operational risks.

---

## 15. Data and Transparency

CrickX separates external sports data from application state.

Sportmonks provides cricket facts such as fixtures, players and scores.

CrickX stores application-owned data such as accounts, fantasy teams, subscriptions, contest entries, prediction entries, application records and settlement records.

On-chain contest settlement provides a public ledger for CRX movements made by the smart contract.

The project repository is maintained as the project's technical source repository. The public website and published documentation remain the primary user-facing reference points.

---

## 16. User Journey

A standard fantasy-user journey is:

**Discover → Subscribe → Select Match → Build XI → Sign Wallet → Join Contest → Match Goes Live → Live Scoring → Final Ranking → CRX Settlement**

A prediction journey is:

**Open Match → Subscribe → Answer 5 Questions → Sign Wallet → Predictions Lock → Match Completes → Results Calculated → CRX Prize Settlement**

This structure keeps the user journey centered on the actual cricket fixture.

---

## 17. Mobile Strategy

The Android application is designed to provide a more focused mobile shell around the CrickX experience.

The current app provides mobile navigation, web-backed authenticated sessions, controlled navigation destinations, external-link restrictions, native loading/error states, and Matches/Fantasy/Wallet/Profile entry points.

The mobile client is designed to consume the same product and API logic as the web client so that game rules remain consistent across platforms.

---

## 18. Roadmap

### Phase 1 — Core platform

- Match Centre
- Fantasy XI builder
- Live scoring
- Contest participation
- CRX prize settlement
- Web application
- Android application

### Phase 2 — Payments and growth

- Subscription billing
- Referral program
- Wallet improvements
- Customer-support and business pages
- Expanded onboarding and payment integrations

### Phase 3 — Prediction ecosystem

- Five-question prediction games
- CRX prediction pools
- Automated result calculation
- Wallet-based settlement
- Expanded cricket prediction formats

### Phase 4 — Scale and ecosystem

- Higher transaction throughput
- Deeper analytics
- More cricket competitions
- Improved mobile-native features
- Additional CRX utilities where they provide genuine product value

Roadmap items are targets rather than guaranteed delivery dates.

---

## 19. Risks and Disclosures

CrickX involves several risks.

### Market risk

CRX is a digital token. Its market value can change materially and may be volatile.

### Smart-contract risk

Smart contracts can contain defects, logic errors or economic assumptions that are not visible during normal user flows.

### Wallet risk

Users are responsible for securing their own wallets, seed phrases and private keys.

### Data-provider risk

Live scores and player information depend on third-party cricket-data infrastructure. Provider outages, corrections or delays can affect the user experience.

### Payment-provider risk

Subscription availability depends on payment-provider systems, webhook delivery and provider policies.

### Regulatory risk

Fantasy sports, prize competitions, digital assets and payment activities may be regulated differently across jurisdictions. CrickX users are responsible for complying with the laws applicable to them.

### Operational risk

CrickX currently contains backend-controlled operational components. The platform therefore includes centralized infrastructure and operator trust assumptions.

---

## 20. Responsible Product Positioning

CrickX is designed as a sports entertainment and competition platform.

CRX prizes are not presented as guaranteed income.

Nothing in this document should be interpreted as investment advice, a guarantee of CRX value, a guarantee of prize earnings, a promise of future token appreciation, or an offer of shares or ownership in CrickX.

Users should participate only where the product and relevant laws permit.

---

## 21. Technical Reference

**Frontend:** Next.js / React, Firebase Hosting, https://crickxfantasy.site

**Backend:** NestJS / TypeScript, Firestore/Postgres-compatible application architecture across project generations, Sportmonks integration, payment-provider integrations, CRX settlement services.

**Mobile:** Expo / React Native, Android distribution.

**Blockchain:** Polygon, ERC-20 CRX token, CRXContestPool contest settlement contract.

**External services:** Sportmonks Cricket API, OxaPay, MetaMask/EVM wallet infrastructure, Firebase services.

---

## 22. Official Links and Contacts

**Website:** https://crickxfantasy.site  
**Whitepaper:** https://crickxfantasy.site/whitepaper/  
**CRX token logo:** https://crickxfantasy.site/crx.svg  
**GitHub:** https://github.com/ejazmanzoor767/CrickX

**Contact:** contact@crickxfantasy.com  
**Info:** info@crickxfantasy.com  
**Support:** support@crickxfantasy.com  
**Owner:** ejazchouhan27@gmail.com

---

## 23. Conclusion

CrickX combines cricket data, fantasy competition, predictions, subscriptions and blockchain settlement into one match-centered platform.

The key design principle is selective use of blockchain: ordinary application activity remains fast and server-managed, while CRX prize custody and settlement use Polygon smart contracts where public token movement and deterministic distribution provide useful transparency.

The current release is an evolving product. Its smart contracts, application infrastructure, payment dependencies and sports-data providers each carry distinct risks. Users should evaluate those risks independently and rely on the latest published application rules and contract state when participating.

**CrickX — Fantasy Cricket + CRX.**
