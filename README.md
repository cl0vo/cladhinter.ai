# Cladhunter

> Watch-to-earn Telegram experience powered by TON. Frontend runs on Vercel, API on Render, data on Neon.

---

## Highlights

- **Watch-to-earn mining** – users farm energy by watching partner creatives.
- **Boosts with TON** – premium multipliers are purchased via TON payments (manual confirmation for now).
- **Partner rewards** – configurable campaigns for Telegram / X / YouTube channels.
- **Session-based auth** – backend issues anonymous tokens and enforces rate limits.
- **Shared config** – ads, boosts and partners live in `shared/` and are reused by both front and back.

---

## Tech Stack at a Glance

| Layer     | Technologies                          | Hosting |
|-----------|----------------------------------------|---------|
| Frontend  | React 18, TypeScript, Vite, Tailwind   | Vercel  |
| Backend   | Node 18, Express, Zod, express-rate-limit, pg | Render  |
| Database  | PostgreSQL                             | Neon    |
| Shared    | TypeScript config modules              | –       |

---

## Repository Layout

```
.
├── backend/                # Express API + Neon/Postgres access
│   ├── src/config.ts       # HTTP / DB / CORS / rate limit settings
│   ├── src/db.ts           # pg pool + schema migrations
│   ├── src/routes.ts       # REST routing (/api/*)
│   └── src/services/       # Business logic (auth, mining, rewards, boosts)
├── frontend/               # Vite + React client for Vercel
│   ├── App.tsx             # Entry point (Mining / Stats / Wallet)
│   ├── hooks/              # Session + data fetching helpers
│   └── utils/api           # Backend client & base URL resolver
├── shared/config/          # Ads, boosts, partner reward definitions
└── docs/DEPLOYMENT.md      # Detailed Vercel + Render + Neon deployment guide
```

Supabase Edge logic, TON proof stubs and unused assets were removed to keep the codebase focused on the new stack.

---

## Authentication & Headers

1. Frontend calls `POST /api/auth/anonymous` (no headers required) to obtain `{ userId, accessToken }`.
2. All other API calls must include:
   - `Authorization: Bearer <accessToken>`
   - `X-User-ID: <userId>`
3. Tokens are stored hashed in `user_tokens`, updated on each request, and subject to rate limiting.

The React hook `useAuth()` handles session bootstrap and persistence (`localStorage`), so most components can rely on `user.id` and `user.accessToken` being available once `loading` is `false`.

---

## API Surface (summary)

| Method | Endpoint                   | Description                            |
|--------|----------------------------|----------------------------------------|
| POST   | `/api/auth/anonymous`      | Issue anonymous user & token           |
| GET    | `/api/health`              | Service health probe                   |
| POST   | `/api/user/init`           | Initialise user session & counters     |
| GET    | `/api/user/balance`        | Current energy, boost level, multiplier|
| GET    | `/api/stats`               | Mining statistics & history            |
| POST   | `/api/ads/complete`        | Register an ad watch                   |
| GET    | `/api/rewards/status`      | Claimed partner rewards summary        |
| POST   | `/api/rewards/claim`       | Claim partner reward                   |
| POST   | `/api/orders/create`       | Create TON boost order                 |
| POST   | `/api/orders/:id/confirm`  | Confirm TON boost payment (manual)     |
| POST   | `/api/payments/ton/webhook` | Render-facing TON webhook (requires secret) |

Response contracts are defined in `frontend/types/index.ts` and implemented under `backend/src/services/userService.ts`.

---

## Local Development

> Requires Node.js 18+ and a Postgres connection (Neon recommended).

```bash
# install dependencies
npm install

# configure environment
cp backend/.env.example backend/.env      # fill DATABASE_URL, merchant wallet, etc.
cp frontend/.env.example frontend/.env    # override VITE_BACKEND_URL if needed

# start API (port 4000)
npm run dev:backend

# start Vite dev server (port 5173)
npm run dev:frontend
```

The frontend automatically resolves `http://localhost:4000/api` when `VITE_BACKEND_URL` is not provided.

---

## Environment Variables

| Variable | Default / Example | Purpose |
|----------|-------------------|---------|
| `DATABASE_URL` | *(required)* | Neon/Postgres connection string (`sslmode=require`) |
| `HOST` | `0.0.0.0` | API bind address |
| `PORT` | `4000` | API port (Render overrides) |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated origin allow-list |
| `MERCHANT_WALLET` | `UQ…JKZ` | TON wallet receiving boost payments |
| `API_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window per IP (ms) |
| `API_RATE_LIMIT_MAX` | `120` | Requests allowed per window |
| `TON_API_BASE_URL` | `https://tonapi.io` | TON API host (optional) |
| `TON_API_KEY` | – | Bearer token for Tonapi (recommended) |
| `TON_WEBHOOK_SECRET` | – | Shared secret for TON webhook endpoint |
| `VITE_BACKEND_URL` *(frontend)* | optional | Force backend URL during build/runtime |

Sample files: `backend/.env.example`, `frontend/.env.example`.

---

## Deployment

1. **Neon** – create a database, grab the pooled URL (`sslmode=require`).
2. **Render** – Web Service (Node), build `npm install && npm run build:backend`, start `npm run start:backend`, add env vars above.
3. **Vercel** – Project build `npm run build:frontend`, output `frontend/dist`, define `VITE_BACKEND_URL` pointing to the Render API.

👉 See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for screenshots, health-check configuration, and operational tips.

---

## Roadmap / Next Steps

- Wire real TON payment verification (webhooks or tonapi) instead of manual confirmation.
- Harden session onboarding by verifying Telegram `initData` signatures.
- Integrate a production ad network or mediation layer and extend analytics.

---

## Status

- ✅ Monorepo refactor (Vercel + Render + Neon)
- ✅ Anonymous session tokens & global rate limiting
- ✅ Shared configuration & cleaned codebase
- ⚠️ Manual TON payment confirmation (webhooks pending)

The project is ready for deployment to Vercel/Render/Neon following the steps above. Let me know when you want to tackle the next roadmap milestone! 
