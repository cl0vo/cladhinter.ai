# Deployment Guide (Vercel + Render + Neon)

This project now ships as a small monorepo:

- `frontend/` — Vite + React client (recommended target: **Vercel**)
- `backend/` — Node/Express API (recommended target: **Render**)
- `shared/` — shared TypeScript resources (ads, boosts, partner config)

The sections below walk through the minimum configuration needed to deploy each service with a managed Postgres database on **Neon**.

---

## 1. Database (Neon)

1. Create a new Neon project and database.
2. Copy the pooled connection string (include `sslmode=require`).
3. Initialise the schema locally by running the backend once (`npm run dev:backend`) or by letting Render run migrations on first boot.

Environment variables required by the backend:

| Variable | Example | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://user:pass@...neon.tech/neondb?sslmode=require` | Required, pooled connection |
| `MERCHANT_WALLET` | `UQ...` | TON wallet that receives boost payments |
| `CORS_ALLOWED_ORIGINS` | `https://cladhunter.vercel.app` | Comma separated list; use `*` for testing |
| `PORT` | `4000` | Render overrides with its own port |
| `API_RATE_LIMIT_WINDOW_MS` | `60000` | Optional, per-IP window in ms |
| `API_RATE_LIMIT_MAX` | `120` | Optional, max requests per window |
| `TON_API_BASE_URL` | `https://tonapi.io` | TON explorer base URL |
| `TON_API_KEY` | `tonapi_...` | Bearer token for Tonapi (recommended) |
| `TON_WEBHOOK_SECRET` | `super-secret` | Shared secret for webhook endpoint |
| `TON_PROOF_ALLOWED_DOMAINS` | `localhost:5173,cladhunter-ai-frontend.vercel.app` | Domains accepted inside TonProof payload |
| `TON_PROOF_TTL_SECONDS` | `900` | Max age for TonProof timestamp |

> Keep a copy of the connection string handy; you will paste it into Render.

---

## 2. Backend API (Render)

1. Create a new **Web Service** on Render and point it to the repository root.
2. Set the **Environment** to `Node`.
3. Set the **Build Command** to `npm install && npm run build:backend`.
4. Set the **Start Command** to `npm run start:backend`.
5. Add the environment variables from the table above.
6. (Optional) Configure auto-deploy and a free tier cron job if you want to keep the instance warm.

Render will expose a URL like `https://cladhunter-api.onrender.com`. Keep that value for the frontend.
The client now authenticates wallets via TonConnect: request a challenge from `GET /api/auth/ton-connect/challenge`, send the wallet proof to `POST /api/auth/ton-connect`, then attach `Authorization` and `X-User-ID` headers to every subsequent call.

---

## 3. Frontend (Vercel)

1. Import the repository into Vercel as a project.
2. Set the **Build Command** to `npm run build:frontend` (defaults to the repo `vercel.json`).
3. Set the **Output Directory** to `frontend/dist` (auto-detected via `frontend/vercel.json` when using the workspace root).
4. Configure environment variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `VITE_BACKEND_URL` | `https://cladhunter-api.onrender.com` | The Render service URL (no trailing slash) |

5. Redeploy. Vercel will inject the `VITE_BACKEND_URL` into the build so that the client talks to the Render API.

TonConnect proof is requested automatically on the frontend: the app fetches `/api/auth/ton-connect/challenge`, sets it as the connect request parameter, and sends the resulting proof back to `/api/auth/ton-connect`.

> Note: The build currently emits a single ~750 kB JS chunk. Vercel logs a warning about the size, but no action is required unless you want to introduce manual chunking or dynamic imports.

During local development you can override the backend URL by editing `frontend/.env`.

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

The backend listens on `http://localhost:4000` by default; the frontend proxy will call the API through `VITE_BACKEND_URL`.

---

## 5. Health Checks

| Service | Endpoint | Description |
| --- | --- | --- |
| Backend | `/api/health` | Returns `{ status: "ok" }` when the API is running |
| Frontend | `/` | Vercel static build |

Configure Render's health check to use `/api/health` to make sure the service is considered healthy after deployment.

---

## 6. Economy Verification

If ad completions do not increase the user balance:

1. Run the backend locally (`npm run dev:backend`) once to execute `ensureDatabase()` (creates tables on Neon).
2. In Neon, confirm that the following tables exist: `users`, `watch_logs`, `session_logs`, `reward_claims`, `orders`, `user_tokens`.
3. Inspect recent watch logs to validate inserts:
   ```sql
   SELECT created_at, reward, multiplier
   FROM watch_logs
   WHERE user_id = '<user-id>'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
4. If logs exist but energy stays unchanged, review Render logs for failed transactions or permission issues.

---

### Next Steps

- Wire real TON payment verification into `backend/src/services/userService.ts`.
- Add authentication hardening (rate limits, signature checks) before going live.
- Schedule regular backups on Neon and monitor connection limits.
