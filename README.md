# Cladhunter

Watch-to-earn mini app for Telegram. Users mine virtual `CL` energy by viewing partner ads, buy reward boosts with TON, and track their progress across Mining, Stats, and Wallet screens.

---

## Highlights

- Mining loop delivers configurable video and banner ads; each completion rewards `CL` energy based on creative type.
- Wallet-bound onboarding uses TonConnect ton-proof (`GET /api/auth/ton-connect/challenge` → `POST /api/auth/ton-connect`) to issue `{ userId, accessToken, walletAddress }`.
- Stats screen aggregates lifetime earnings, daily usage, active multiplier, and the latest watch history so users can track performance.
- Wallet integrates TonConnect for paid boosts; orders return encoded comment payloads and the server validates TON transfers before applying multipliers.
- Partner campaigns grant one-off bonuses, while referral sharing and planned withdrawals pave the way for growth and monetisation.

---

## Architecture Overview

| Layer    | Stack / Tools                                   | Hosting |
|----------|--------------------------------------------------|---------|
| Frontend | React 18, TypeScript, Vite, Tailwind, TonConnect | Vercel  |
| Backend  | Node 18, Express, Zod, pg, express-rate-limit    | Render  |
| Database | PostgreSQL                                       | Neon    |
| Shared   | TypeScript configs (ads, economy, partners)      | Shared  |

Repository layout:

```
.
|- backend/              # Express API, Ton integration, schema bootstrap
|- frontend/             # Vite client with Mining / Stats / Wallet screens
|- shared/config/        # Ads, economy, partner campaign definitions
\- docs/                 # Deployment and product documentation
```

---

## Core Flow

1. **Telegram launch**: The mini app opens in full-screen mode via the Telegram WebApp API. The client fetches a ton-proof challenge (`GET /api/auth/ton-connect/challenge`), forwards it to the connected wallet with TonConnect, and exchanges the signed proof via `POST /api/auth/ton-connect` to obtain `{ userId, accessToken, walletAddress }`.
2. **Mining**: The Mining screen renders creatives from `shared/config/ads.ts`. Rewards per ad are pulled from `ENERGY_PER_AD` (examples: short video +10 CL, long video +25 CL, promo banner +50 CL). After a valid view the client posts `/api/ads/complete { ad_id }`; the backend enforces a 30 second cooldown and a 200 ad daily limit, updates `users.energy`, logs the event, and returns the new balance.
3. **Stats**: `/api/stats` returns aggregates (total CL earned, watch counts, streak data, boost multiplier) plus the latest watch log entries so users see recent gains.
4. **Wallet & boosts**: `POST /api/orders/create` sets up TON payments with an encoded comment payload. TonConnect sends the transaction; a TonAPI webhook (or a manual `/api/orders/:id/confirm` call with the transaction hash) finalises the order before the multiplier is applied.
5. **Partner rewards**: Users claim bonuses with `/api/rewards/claim` using partner IDs from `shared/config/partners.ts`. The API prevents duplicate claims and logs the reward.
6. **Referrals & withdrawals**: UI surfaces referral links (`https://cladhunter.app/ref/<userId>`) and a disabled Withdraw button. Backend implementation is pending; the roadmap covers referral tracking, anti-fraud, and future redemption mechanics.

---

## API Surface

| Method | Endpoint                            | Description                                        |
|--------|-------------------------------------|----------------------------------------------------|
| GET    | `/api/auth/ton-connect/challenge`   | Generate TonConnect ton-proof payload              |
| POST   | `/api/auth/ton-connect`             | Verify ton-proof and issue wallet-bound session    |
| GET    | `/api/health`                       | Health probe for uptime checks                     |
| POST   | `/api/user/init`                    | Initialise counters and session log                |
| GET    | `/api/user/balance`                 | Current balance, boost state, multiplier           |
| GET    | `/api/stats`                        | Lifetime stats and recent watch history            |
| POST   | `/api/ads/complete`                 | Register ad completion (cooldown and limits apply) |
| GET    | `/api/rewards/status`               | List claimed partner rewards and remaining bonuses |
| POST   | `/api/rewards/claim`                | Grant partner reward if eligible                   |
| POST   | `/api/orders/create`                | Create TON boost order                             |
| POST   | `/api/orders/:id/confirm`           | Manually confirm TON payment with a transaction hash |
| POST   | `/api/payments/ton/webhook`         | TonAPI webhook for asynchronous settlement         |

Response contracts are shared with the frontend under `frontend/types/`.

---

## Build & Run Modes

### Production (Vercel)

The shipped bundle is built for the public Vercel deployment. Before running `npm run build:frontend`, export `VITE_BACKEND_URL` so the client calls the live Render API (for example `https://cladhunter-api.onrender.com`). Deploy `frontend/dist` to Vercel; the app is served from `https://cladhunter.vercel.app` or your configured custom domain.

```bash
npm install
VITE_BACKEND_URL=https://cladhunter-api.onrender.com npm run build:frontend
```

### Local debugging

> Requires Node.js 18+ and access to a PostgreSQL instance (Neon recommended).

```bash
npm install                                # install workspace dependencies
cp backend/.env.example backend/.env       # configure DATABASE_URL, TON keys, etc.
cp frontend/.env.example frontend/.env     # optional VITE_BACKEND_URL override

npm run dev:backend                        # start Express API on http://localhost:4000
npm run dev:frontend                       # start Vite dev server on http://localhost:5173
```

When debugging locally you may omit `VITE_BACKEND_URL` and the client falls back to `http://localhost:4000/api`. Production builds must set `VITE_BACKEND_URL` to the Render URL.

---

## Key Environment Variables

### backend/.env

- `DATABASE_URL` - Neon connection string (`sslmode=require`).
- `HOST` / `PORT` - binding options (Render overrides port in production).
- `CORS_ALLOWED_ORIGINS` - comma separated allow list for the API.
- `MERCHANT_WALLET` - TON wallet that receives boost payments.
- `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX` - per-IP throttling guardrails.
- `TON_API_BASE_URL`, `TON_API_KEY` - TonAPI configuration for payment verification.
- `TON_WEBHOOK_SECRET` - header token required on webhook requests.

### frontend/.env

- `VITE_BACKEND_URL` - explicit API base (Render URL) if auto detection is not desired.
- `VITE_POSTHOG_KEY` - PostHog project key used for analytics capture (optional).
- `VITE_POSTHOG_HOST` - PostHog API host override when using EU/US clusters (optional).

Restart the relevant dev server when environment values change.

---

## Deployment Basics

1. **Database**: Provision Neon, copy the pooled `DATABASE_URL`, and ensure `sslmode=require`.
2. **Backend (Render)**:
   - Build command: `npm install && npm run build:backend`
   - Start command: `npm run start:backend`
   - Set environment variables listed above
   - Health check path: `/api/health`
3. **Frontend (Vercel)**:
   - Build command: `npm run build:frontend`
   - Output directory: `frontend/dist`
   - Environment: `VITE_BACKEND_URL=https://<render-service>.onrender.com`
4. **Smoke test**: hit `/api/health` and `/api/auth/ton-connect/challenge`, walk through Mining (ad complete, stats update), claim a partner reward, send a TON payment for a boost, and ensure the webhook (or manual `/api/orders/:id/confirm` with a transaction hash) activates the boost.

Detailed steps live in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Current Risks and Gaps

- **Identity**: Anonymous sessions create a new account per device. Binding Telegram `initData` (and optionally Ton wallet) is required to merge profiles and prevent multi-account abuse.
- **Payments**: Boost activation now requires a verified TON transaction hash. Wire the TonAPI webhook in production so boosts settle automatically and users rarely need manual confirmation.
- **Economy & UX**: Onboarding, localisation (RU/EN), friendly error copy, and inactive Withdraw button adjustments are needed ahead of launch.
- **Analytics**: PostHog SDK instrumented on the frontend (session/ad/boost events). Backend logging and error tracking still pending.
- **Referrals and withdrawals**: UI promises functionality that the backend does not yet implement. Prioritise referral tracking, caps, and payout design.

See [`docs/PRODUCT_ANALYSIS.md`](docs/PRODUCT_ANALYSIS.md) for a full product audit, phased roadmap, and execution plan.
