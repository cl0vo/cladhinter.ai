# Cladhunter

> Modern watch-to-earn experience for Telegram. React/Vite frontend deploys to Vercel, Express/Postgres backend runs on Render, data lives in Neon.

---

## Highlights

- **Mining by watching ads** � configurable creatives (video/image) reward users with in-game energy.
- **TON-powered boosts** � premium multipliers are purchased with TON; payments are validated through Tonapi or webhook callbacks.
- **Partner campaigns** � flexible reward system for Telegram / X / YouTube communities.
- **Wallet-bound sessions** � TonConnect proof links CL balances to a verified TON wallet.
- **Shared configs** � ads / boosts / partners live in `shared/` and are reused on both layers.
---

## Tech Stack

| Layer     | Technologies                                  | Hosting |
|-----------|-----------------------------------------------|---------|
| Frontend  | React 18 · TypeScript · Vite · Tailwind · TonConnect UI | Vercel  |
| Backend   | Node 18 · Express · Zod · pg · express-rate-limit | Render  |
| Database  | Neon PostgreSQL                               | Neon    |
| Shared    | TypeScript config modules                     | –       |

---

## Repository Layout

```
.
├── backend/                 # Express API + Neon connector
│   ├── src/config.ts        # env parsing (HTTP, DB, CORS, TON, rate-limit)
│   ├── src/db.ts            # pg pool + schema migrations
│   ├── src/routes.ts        # REST endpoints (/api/*)
│   └── src/services/        # authService, userService, tonService, …
├── frontend/                # Vite + React client (mobile-first)
│   ├── App.tsx              # Mining / Stats / Wallet navigation shell
│   ├── hooks/               # useAuth, useApi, useUserData, ...
│   ├── components/          # UI blocks (shadcn-based)
│   └── utils/api/client.ts  # backend request helper + base URL resolver
├── shared/config/           # ads / economy / partners definitions
└── docs/DEPLOYMENT.md       # Vercel + Render + Neon deployment guide
```

Legacy Supabase/Deno logic has been removed.

---

## Authentication Flow

1. Frontend requests a challenge via `GET /api/auth/ton-connect/challenge` and feeds the payload into TonConnect `tonProof`.
2. The connected wallet signs the payload and returns `ton_proof` together with its address, public key and `walletStateInit`.
3. Frontend sends the proof to `POST /api/auth/ton-connect`; the backend verifies the signature, checks the allowed domain, derives the wallet address from `state_init`, and issues `{ userId, accessToken, walletAddress }`.
4. Each subsequent request must send:
   - `Authorization: Bearer <accessToken>`
   - `X-User-ID: <userId>`
5. Sessions are stored per wallet address; `useAuth()` refreshes the proof when the wallet reconnects.

---

## API Surface

| Method | Endpoint                      | Description                                  |
|--------|--------------------------------|----------------------------------------------|
| GET    | `/api/auth/ton-connect/challenge` | Generate TonProof payload challenge        |
| POST   | `/api/auth/ton-connect`        | Verify TonProof and issue wallet session     |
| GET    | `/api/health`                  | Service health probe                         |
| POST   | `/api/user/init`               | Initialise user session & counters           |
| GET    | `/api/user/balance`            | Energy, boost level, multiplier              |
| GET    | `/api/stats`                   | Mining statistics + watch history            |
| POST   | `/api/ads/complete`            | Register ad view (cooldown + limits apply)   |
| GET    | `/api/rewards/status`          | Claimed partner rewards                      |
| POST   | `/api/rewards/claim`           | Claim partner reward                         |
| POST   | `/api/orders/create`           | Create TON boost order                       |
| POST   | `/api/orders/:id/confirm`      | Manual confirmation + Tonapi verification    |
| POST   | `/api/payments/ton/webhook`    | Render-facing TON webhook (requires secret)  |

Response contracts are defined in `frontend/types/index.ts`.

---

## Local Development

> Requires Node.js 18+ and access to a Postgres database (Neon recommended).

```bash
# install deps (workspace aware)
npm install

# configure environment
cp backend/.env.example backend/.env      # fill DATABASE_URL, TON vars, etc.
cp frontend/.env.example frontend/.env    # optional: override VITE_BACKEND_URL

# start services
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:5173
```

When `VITE_BACKEND_URL` is omitted the client auto-targets `http://localhost:4000/api`.

---

## Environment Variables

| Variable | Default / Example | Purpose |
|----------|-------------------|---------|
| `DATABASE_URL` | *(required)* | Neon/Postgres connection string (`sslmode=require`) |
| `HOST` / `PORT` | `0.0.0.0` / `4000` | API bind settings (Render overrides port) |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma separated allow-list |
| `MERCHANT_WALLET` | `UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ` | Merchant TON wallet |
| `API_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window per IP (ms) |
| `API_RATE_LIMIT_MAX` | `120` | Requests allowed per window |
| `TON_API_BASE_URL` | `https://tonapi.io` | Tonapi host |
| `TON_API_KEY` | *(optional)* | Tonapi bearer token (recommended) |
| `TON_WEBHOOK_SECRET` | *(optional)* | Shared secret expected by webhook |
| `TON_PROOF_ALLOWED_DOMAINS` | `localhost:5173,cladhunter-ai-frontend.vercel.app` | Domains accepted inside TonProof payload |
| `TON_PROOF_TTL_SECONDS` | `900` | Max age for TonProof timestamp |
| `VITE_BACKEND_URL` *(frontend)* | *(optional)* | Static API base during build/runtime |

Use the templates in `backend/.env.example` and `frontend/.env.example`.

---

## Deployment (Vercel + Render + Neon)

1. **Neon** – create database, copy pooled `DATABASE_URL` (with `sslmode=require`).
2. **Render** – Web Service (Node):
   - Build: `npm install && npm run build:backend`
   - Start: `npm run start:backend`
   - Set env vars listed above
   - Health-check: `/api/health`
3. **Vercel** – Project:
   - Build: `npm run build:frontend` (defaults to repo `vercel.json`)
   - Output: `frontend/dist` (auto-detected via `frontend/vercel.json`)
   - Env: `VITE_BACKEND_URL=https://<render-service>.onrender.com`
4. Smoke test after deploy: `/api/health`, `/api/auth/ton-connect`, mining flow, reward claim, TON webhook.

Detailed walkthrough → [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Roadmap / Next Steps

- Finalise TON payment automation with dedicated webhook source (Tonapi / toncenter).
- Harden authentication by signing Telegram `initData`.
- Integrate production ad network + analytics dashboard.
- Build admin console for creatives, boosts, partners.

---

## Current Status

- ✅ Monorepo refactor (Vercel + Render + Neon)
- ✅ Anonymous session tokens & global rate limiting
- ✅ Tonapi verification + webhook handler for TON payments
- ✅ Shared config, cleaned documentation
- ✅ Frontend build & stats/mining flow verified on Vercel
- ⚠️ Economy accrual (`CL` rewards) under investigation — watch logs + balance update path under review
- ⚠️ Monitoring + webhook hardening still require production wiring

Ready for deployment following the steps above. Ping the team before starting a roadmap item or adjusting shared configs.

---

## Economy Troubleshooting

> Use this when ad views are processed but balances stay unchanged.

1. **Ensure migrations ran**: `npm run dev:backend` will call `ensureDatabase()` and create the required tables if they are missing.
2. **Verify schema in Neon** – the economy flow expects these tables:
   - `users` (energy, boost_level, totals, timestamps)
   - `watch_logs` (per-ad reward history)
   - `session_logs`
   - `reward_claims`
   - `orders`
   - `user_tokens`
3. **Manual check** – run:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('users','watch_logs','session_logs','reward_claims','orders','user_tokens');
   ```
   Missing tables mean the backend couldn’t bootstrap the schema.
4. **Inspect watch logs** – confirm ad completions are being recorded:
   ```sql
   SELECT created_at, reward, multiplier
   FROM watch_logs
   WHERE user_id = '<user-id>'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
   If entries appear here but `users.energy` stays flat, check for failed transactions/rollbacks in Render logs.
5. **Claim rewards** – ensure boosts and partner rewards update the balance:
   ```sql
   SELECT reward, partner_name, claimed_at
   FROM reward_claims
   WHERE user_id = '<user-id>'
   ORDER BY created_at DESC;
   ```
   No rows indicate the claim path did not persist; inspect API logs for `reward already claimed` or transaction failures.







