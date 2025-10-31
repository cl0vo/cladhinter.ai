# Cladhunter Engineer Handbook (October 2025)

This handbook keeps the team aligned on architecture, code conventions, product flow, and launch priorities. Read it end-to-end before shipping changes.

---

## 1. Architecture Snapshot

| Layer    | Stack / Tooling                                   | Hosting |
|----------|---------------------------------------------------|---------|
| Frontend | React 18, TypeScript, Vite, Tailwind, TonConnect  | Vercel  |
| Backend  | Node 18, Express, Zod, pg, express-rate-limit     | Render  |
| Database | PostgreSQL (Neon)                                 | Neon    |
| Shared   | TypeScript configs for ads, economy, partners     | Shared  |

Core truths:

- Sessions are wallet-bound: the client fetches a TonConnect challenge (`GET /api/auth/ton-connect/challenge`), signs it in the wallet, and exchanges it via `POST /api/auth/ton-connect` to obtain `{ userId, accessToken, walletAddress }` for all subsequent API calls.
- Ads, boost tiers, and partner campaigns are defined once in `shared/config` and consumed by both frontend and backend.
- Payments for boosts rely on TonConnect. Orders are created on our backend, paid in the user wallet, then confirmed by TonAPI or webhook callbacks.

---

## 2. Repository Layout

```
.
|--- backend/
|   |--- src/config.ts           # HTTP, DB, CORS, rate limiting, TON config
|   |--- src/db.ts               # pg pool, schema bootstrap
|   |--- src/routes.ts           # REST routes mounted under /api
|   \--- src/services/           # authService, userService, tonService, etc.
|--- frontend/
|   |--- App.tsx                 # Bottom navigation, Mining / Stats / Wallet
|   |--- hooks/                  # useAuth, useApi, useUserData, useTonConnect
|   |--- components/             # UI primitives and domain widgets
|   \--- utils/api/client.ts     # API client with auth header wiring
|--- shared/config/              # Ads, economy, partner campaign definitions
\--- docs/                       # Deployment guide, product analysis, research
```

Legacy Supabase or Deno code has been removed. Do not reintroduce it.

---

## 3. Local Development

```bash
npm install                                # install workspace dependencies
cp backend/.env.example backend/.env       # configure DATABASE_URL, TON keys, etc.
cp frontend/.env.example frontend/.env     # optional VITE_BACKEND_URL override

npm run dev:backend                        # Express API on http://localhost:4000
npm run dev:frontend                       # Vite dev server on http://localhost:5173
```

If `VITE_BACKEND_URL` is missing the client defaults to `http://localhost:4000/api`.

To run both services together use two terminals or a process manager (for example `npm run dev --workspaces` once scripts exist).

---

## 4. Environment Variables

### backend/.env

- `DATABASE_URL` - Neon connection string (`sslmode=require`).
- `HOST` / `PORT` - bind options (Render overrides port in production).
- `CORS_ALLOWED_ORIGINS` - comma separated list for allowed origins.
- `MERCHANT_WALLET` - TON wallet that receives boost payments.
- `API_RATE_LIMIT_WINDOW_MS` / `API_RATE_LIMIT_MAX` - global rate limiting per IP.
- `TON_API_BASE_URL` / `TON_API_KEY` - TonAPI endpoint and token for payment checks.
- `TON_WEBHOOK_SECRET` - expected header for webhook verification.

### frontend/.env

- `VITE_BACKEND_URL` - explicit API base (Render URL).

Restart the relevant dev server each time you change `.env`.

---

## 5. API Reference (server truth)

1. `GET /api/auth/ton-connect/challenge` -> `{ payload }`
2. `POST /api/auth/ton-connect` -> `{ userId, accessToken, walletAddress }`
3. Clients send `Authorization: Bearer <token>` and `X-User-ID: <userId>` with every subsequent request. Wallet bindings are enforced via the returned `walletAddress`.
4. Rate limiting defaults to 120 requests per IP per minute (see config).

| Method | Route                            | Purpose                                               |
|--------|----------------------------------|-------------------------------------------------------|
| GET    | `/api/auth/ton-connect/challenge`| Issue TonConnect ton-proof payload                    |
| POST   | `/api/auth/ton-connect`          | Verify proof and issue wallet session                 |
| GET    | `/api/health`                    | Render health probe                                   |
| POST   | `/api/user/init`                 | Initialise counters, session log                      |
| GET    | `/api/user/balance`              | Energy, boost level, multiplier, cooldown state       |
| GET    | `/api/stats`                     | Totals plus latest watch logs                         |
| POST   | `/api/ads/complete`              | Register ad completion (cooldown + daily limit)       |
| GET    | `/api/rewards/status`            | Claimed partner rewards and pending opportunities     |
| POST   | `/api/rewards/claim`             | Grant partner reward (one-off per partner)            |
| POST   | `/api/orders/create`             | Create TON boost order with encoded comment payload   |
| POST   | `/api/orders/:id/confirm`        | Manually confirm TON transfer using a transaction hash |
| POST   | `/api/payments/ton/webhook`      | Webhook for asynchronous TON payment confirmation     |

Refer to `frontend/types/` when adjusting response contracts.

---

## 6. Frontend Conventions

- `useAuth` owns session lifecycle (localStorage persistence, header injection, revalidation).
- All HTTP calls go through `useApi` / `apiRequest` to ensure headers and error handling are consistent.
- UI primitives live under `frontend/components/ui/`. Keep naming and exports aligned with existing patterns.
- Styling uses Tailwind with a dark neon theme. Keep layouts mobile-first and respect safe areas.
- Toasts use `sonner`; icons come from `lucide-react`.
- When adding strings, keep them centralised for upcoming localisation (RU/EN).

---

## 7. Backend Conventions

- Validate request payloads with Zod in the route layer.
- Use `db.ts` helpers (`query`, `withTransaction`) for database access. Transactions are mandatory for multi-step mutations (ad completion, payments, rewards).
- Schema migrations currently live in `runSchemaMigrations`. Until a formal tool lands, keep changes idempotent and backward compatible.
- Ton payments must be checked through `tonService`. Never mark an order paid without verification.
- Return errors as `{ error: "message" }` with appropriate HTTP status codes.

---

## 8. Shared Config Rules

- `shared/config/ads.ts` - list of creatives, metadata, reward tiers.
- `shared/config/economy.ts` - energy per ad type, cooldown, daily limits, boost tiers.
- `shared/config/partners.ts` - partner reward definitions (`id`, `name`, `reward`, `active`).

Any change must remain compatible with both frontend and backend. When fields change, update types and runtime validation on both sides.

---

## 9. Testing and QA

Automated tests are not yet in place. Run this manual smoke checklist before merging:

1. Start `npm run dev:backend` and `npm run dev:frontend`.
2. Load the app in Telegram web preview or browser; confirm the TonConnect handshake (`/api/auth/ton-connect/challenge` + `/api/auth/ton-connect`) succeeds.
3. Complete ad views until cooldown triggers; validate balance increases and limit messaging.
4. Claim at least one partner reward and confirm it is locked out afterward.
5. Create a boost order. Simulate payment confirmation by calling `/api/orders/:id/confirm` with a TonAPI-verified `tx_hash` or by posting to the webhook with the shared secret.
6. Review `GET /api/stats` to verify watch log entries align with recent activity.

Log issues in the project channel before merging significant changes.

---

## 10. Deployment Checklist (Vercel + Render + Neon)

1. **Neon**
   - Provision database.
   - Copy pooled `DATABASE_URL` with `sslmode=require`.
2. **Render**
   - Build: `npm install && npm run build:backend`
   - Start: `npm run start:backend`
   - Set backend environment variables (see Section 4).
   - Configure health check `/api/health`.
3. **Vercel**
   - Build: `npm run build:frontend`
  - Output: `frontend/dist`
   - Env: `VITE_BACKEND_URL=https://<render-service>.onrender.com`
4. **Post-deploy smoke test**
   - `/api/health`
   - `/api/auth/ton-connect/challenge`
   - TonConnect login and mining flow end-to-end
   - Partner reward claim
   - TON payment webhook (or manual `/api/orders/:id/confirm` with a transaction hash)

Detailed instructions with screenshots live in `docs/DEPLOYMENT.md`.

---

## 11. Product Experience Snapshot

Derived from the October 2025 product research:

- Mining screen loops through ads (video or image) and pays `CL` energy based on creative type (`ENERGY_PER_AD` config). Cooldown is 30 seconds; daily limit is 200 ads.
- Stats screen shows lifetime energy, total ads watched, active multiplier, session count, daily usage, and latest watch logs (reward plus multiplier).
- Wallet tab integrates TonConnect. Users buy time-limited boosts (Bronze x1.25, Silver x1.5, etc.). Each order returns an encoded comment payload; TonAPI webhook (or a manual transaction-hash confirmation) validates the payment before the boost activates and is marked `ACTIVE`.
- Partner rewards allow one-time bonuses defined in `shared/config/partners.ts`. Backend ensures each user can claim a given partner only once.
- Referral UI shares `https://cladhunter.app/ref/<userId>` and promises +10% bonus capped at 50 CL per month, but backend logic still needs implementation.
- Withdraw button is visible but inactive; messaging or hidden state is required until redemption mechanics are ready.

---

## 12. Known Gaps and Risks

**Architecture**
- Sessions are wallet-bound but not tied to Telegram identity; bind Telegram `initData` (and optionally additional signals) to prevent multi-account abuse.
- Boost confirmation depends on TonAPI verification with a transaction hash. Configure and monitor the TonAPI webhook in production so users rarely need manual confirmation.
- Render and Neon scaling has not been tested for 1k+ concurrent users. Increase connection pools and run load tests.
- Inline schema migrations are fragile. Introduce a managed migration tool before altering production schema.

**UX and localisation**
- No onboarding or glossary. Add first-run guidance, explain `CL` energy, and localise key copy to Russian.
- Error messages surface raw API strings. Replace with friendly, localised messages.
- Withdraw CTA should either be hidden or carry "coming soon" messaging until implemented.

**Features**
- Referral programme lacks backend support (tracking, rewards, caps, anti-fraud).
- Withdrawal and payout mechanics are undefined; clarify before promising external value.
- Admin console for creatives and economy tuning is missing. Roadmap item remains open.

**Security and fraud prevention**
- No behavioural safeguards beyond cooldown. Monitor `ads/complete` cadence and introduce checks (e.g., minimum watch duration, captcha) if abuse appears.
- Payment webhook is not fully wired. Register TonAPI webhook with shared secret and payload mapping.

**Analytics and marketing**
- No analytics SDK. Instrument activation, retention, boost conversion, and referral metrics.
- Ad click tracking is absent. Add API logging to demonstrate ROI to partners.
- Launch marketing assets (landing page, Telegram channel, partner brief) need owners and timelines.

---

## 13. Roadmap (execution view)

| Phase | Objective | Key Deliverables |
|-------|-----------|------------------|
| MVP Launch (0-1k users) | Ship trustworthy core loop | Telegram initData auth, strict TON payment confirmation, RU/EN onboarding, analytics baseline, beta feedback |
| Growth (1k-10k users)   | Scale content and monetisation | Render/Neon scaling plan, ad/admin tooling, referral backend with anti-fraud, events or streaks, partner campaign operations |
| Retention (10k+ users)  | Deepen engagement and trust | Leaderboards and achievements, advanced anti-abuse, withdrawal UX, richer analytics dashboards, community operations |

---

## 14. Immediate Work Queue

- [ ] Draft Telegram identity binding (data contract, DB changes, frontend wiring) and create implementation tickets.
- [ ] Configure TonAPI webhook delivery (deploy secret, set up retries/alerts) so boost settlements happen automatically without manual hashes.
- [ ] Prepare onboarding flow and localisation checklist; extract copy for RU translation.
- [ ] Select analytics tooling (GA, Amplitude, PostHog, etc.) and outline instrumentation.
- [ ] Assemble marketing collateral checklist (landing page, Telegram channel, partner brief) and define referral backend scope.

Keep this handbook updated as features ship or architecture changes. PME (product, marketing, engineering) leads own the roadmap sections.
