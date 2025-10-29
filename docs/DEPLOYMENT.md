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

---

## 3. Frontend (Vercel)

1. Import the repository into Vercel as a project.
2. Set the **Build Command** to `npm run build:frontend`.
3. Set the **Output Directory** to `frontend/dist`.
4. Configure environment variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `VITE_BACKEND_URL` | `https://cladhunter-api.onrender.com` | The Render service URL (no trailing slash) |

5. Redeploy. Vercel will inject the `VITE_BACKEND_URL` into the build so that the client talks to the Render API.

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

### Next Steps

- Wire real TON payment verification into `backend/src/services/userService.ts`.
- Add authentication hardening (rate limits, signature checks) before going live.
- Schedule regular backups on Neon and monitor connection limits.
