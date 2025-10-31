# Deployment Guide (Vercel + Render + Neon)

Cladhunter runs as a small monorepo: Vite frontend, Express backend, shared TypeScript configs, and a Neon PostgreSQL database. This guide covers the minimum configuration needed to launch the stack.

---

## 1. Prepare the Database (Neon)

1. Create a Neon project and database.
2. Copy the pooled connection string and append `sslmode=require`.
3. Run the backend locally (`npm run dev:backend`) to execute schema bootstrap, or let Render do the first-time migration.

Key backend environment variables:

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgres://user:pass@...neon.tech/neondb?sslmode=require` | Required pooled connection |
| `MERCHANT_WALLET` | `UQ...` | TON wallet that receives boost payments |
| `CORS_ALLOWED_ORIGINS` | `https://cladhunter.vercel.app` | Comma separated list; use `*` only for testing |
| `HOST` / `PORT` | `0.0.0.0` / `4000` | Render overrides port |
| `API_RATE_LIMIT_WINDOW_MS` | `60000` | Optional per-IP window (ms) |
| `API_RATE_LIMIT_MAX` | `120` | Optional max requests per window |
| `TON_API_BASE_URL` | `https://tonapi.io` | TonAPI base URL |
| `TON_API_KEY` | `tonapi_...` | TonAPI bearer token (recommended) |
| `TON_WEBHOOK_SECRET` | `super-secret` | Shared secret expected on webhook |

Keep the connection string handy for Render configuration.

---

## 2. Backend API (Render)

1. Create a **Web Service** on Render and point it at the repository root.
2. Environment: `Node`.
3. Build command: `npm install && npm run build:backend`.
4. Start command: `npm run start:backend`.
5. Add the environment variables listed above.
6. Set health check path to `/api/health`.

Render will expose a URL such as `https://cladhunter-api.onrender.com`. This value is used by the frontend.

Sessions are wallet-bound. The frontend retrieves a TonConnect challenge (`GET /api/auth/ton-connect/challenge`), exchanges the signed proof via `POST /api/auth/ton-connect`, and reuses the returned `{ userId, accessToken, walletAddress }`. Boost purchases create orders, send TON with the encoded comment payload, and settle once TonAPI confirms the transaction (via webhook or a manual `/api/orders/:id/confirm` with the transaction hash).

---

## 3. Frontend (Vercel)

1. Import the repository into Vercel as a project.
2. Build command: `npm run build:frontend`.
3. Output directory: `frontend/dist`.
4. Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_BACKEND_URL` | `https://cladhunter-api.onrender.com` |

Re-deploy. Vercel injects `VITE_BACKEND_URL` into the build so the client can reach the Render API. During local development override this value in `frontend/.env`.

---

## 4. Local Development Checklist

```bash
# install dependencies
npm install

# backend terminal
cp backend/.env.example backend/.env
npm run dev:backend

# frontend terminal
cp frontend/.env.example frontend/.env
npm run dev:frontend
```

The backend listens on `http://localhost:4000`; the frontend defaults to calling `http://localhost:4000/api` unless you override `VITE_BACKEND_URL`.

---

## 5. Smoke Test After Deploy

1. `GET /api/health` returns `{ "status": "ok" }`.
2. `GET /api/auth/ton-connect/challenge` returns the ton-proof payload and `POST /api/auth/ton-connect` returns `{ userId, accessToken, walletAddress }`.
3. Walk through the Mining flow: view an ad, confirm `/api/ads/complete` responds with updated balance, and check `/api/stats` for new history entries.
4. Claim a partner reward with `/api/rewards/claim` and verify it disappears from `/api/rewards/status`.
5. Create a boost order (`/api/orders/create`), send a TON payment through TonConnect, and wait for the TonAPI webhook (or call `/api/orders/:id/confirm` with the transaction hash) to activate the boost.

---

## 6. Troubleshooting Economy Issues

If ad completions do not raise the balance:

1. Ensure `ensureDatabase()` ran by starting the backend once.
2. In Neon, confirm required tables exist: `users`, `watch_logs`, `session_logs`, `reward_claims`, `orders`, `user_tokens`.
3. Inspect recent watch logs:
   ```sql
   SELECT created_at, reward, multiplier
   FROM watch_logs
   WHERE user_id = '<user-id>'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
4. If logs are present but energy is not increasing, check Render logs for errors or transaction rollbacks.

---

## 7. Next Steps

- Wire TonAPI webhook (`/api/payments/ton/webhook`) in production and monitor settlements.
- Harden authentication by validating Telegram `initData` and tightening confirmation rules for boosts.
- Configure Neon backups and monitor connection usage as user counts rise.
