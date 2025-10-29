# Cladhunter • Engineer Handbook (October 2025)

Welcome aboard! This guide keeps the crew aligned on the live architecture, code conventions, deployment flow, and roadmap. Read it before touching the repo — it has changed a lot from the old Supabase stack.

---

## 1. Architecture Snapshot

| Layer     | Stack                                            | Hosting |
|-----------|--------------------------------------------------|---------|
| Frontend  | React 18, TypeScript, Vite, Tailwind, TonConnect | Vercel  |
| Backend   | Node 18, Express, Zod, pg, express-rate-limit    | Render  |
| Database  | PostgreSQL                                       | Neon    |
| Shared    | TypeScript config (ads / economy / partners)     | –       |

- **Sessions**: Anonymous tokens issued by the API (`/api/auth/anonymous`).  
- **Auth headers**: Every protected route expects `Authorization: Bearer <token>` and `X-User-ID: <id>`.  
- **Data sync**: Ads, boosts, partners live in `shared/` and are consumed by both layers.

---

## 2. Repository Layout

```
.
├── backend/
│   ├── src/config.ts           # HTTP / DB / CORS / rate-limit / TON config
│   ├── src/db.ts               # pg pool + schema migrations
│   ├── src/routes.ts           # REST routes (/api/*)
│   └── src/services/           # authService, userService, tonService, etc.
├── frontend/
│   ├── App.tsx                 # Mining / Stats / Wallet container
│   ├── hooks/                  # useAuth, useApi, useUserData, useTonConnect
│   ├── components/             # UI blocks (shadcn-based)
│   └── utils/api/client.ts     # Backend request helper + base URL resolver
├── shared/config/              # Ads / economy / partner definitions
└── docs/DEPLOYMENT.md          # Step-by-step Vercel + Render + Neon deploy
```

Legacy Supabase/Deno code has been removed — do not reintroduce it.

---

## 3. Local Development Cheat Sheet

```bash
npm install                                # installs workspace deps
cp backend/.env.example backend/.env       # set DATABASE_URL, MERCHANT_WALLET, TON vars
cp frontend/.env.example frontend/.env     # optional: override VITE_BACKEND_URL
npm run dev:backend                        # Express API on http://localhost:4000
npm run dev:frontend                       # Vite dev server on http://localhost:5173
```

If `VITE_BACKEND_URL` is omitted, the client auto-targets `http://localhost:4000/api`.

---

## 4. Environment Variables

### backend/.env
- `DATABASE_URL` – Neon connection string (`sslmode=require` mandatory).
- `HOST` / `PORT` – Render overrides port in production.
- `CORS_ALLOWED_ORIGINS` – comma separated allow-list.
- `MERCHANT_WALLET` – TON wallet receiving boost payments.
- `API_RATE_LIMIT_WINDOW_MS` / `API_RATE_LIMIT_MAX` – per-IP rate limiting.
- `TON_API_BASE_URL` – Tonapi host (defaults to `https://tonapi.io`).
- `TON_API_KEY` – Tonapi bearer token (recommended to avoid public limits).
- `TON_WEBHOOK_SECRET` – shared secret expected in `x-webhook-secret`.

### frontend/.env
- `VITE_BACKEND_URL` – explicit API base (Render URL), overrides auto-detect.

Restart the corresponding dev server whenever you change `.env`.

---

## 5. API Reference

1. `POST /api/auth/anonymous` → `{ userId, accessToken }`
2. Include `Authorization` + `X-User-ID` headers on every subsequent request.
3. Tokens are hashed in `user_tokens`, `last_used_at` updates automatically.
4. Rate limiting is global (see `API_RATE_LIMIT_*`).

| Method | Route                         | Purpose                                |
|--------|------------------------------|----------------------------------------|
| POST   | `/api/auth/anonymous`        | Issue anonymous session token          |
| GET    | `/api/health`                | Render health probe                    |
| POST   | `/api/user/init`             | Initialise counters & session log      |
| GET    | `/api/user/balance`          | Energy, boost level, multiplier        |
| GET    | `/api/stats`                 | Mining statistics + watch history      |
| POST   | `/api/ads/complete`          | Register an ad watch                   |
| GET    | `/api/rewards/status`        | Claimed partner rewards list           |
| POST   | `/api/rewards/claim`         | Grant partner reward                   |
| POST   | `/api/orders/create`         | Create TON boost order                 |
| POST   | `/api/orders/:id/confirm`    | Manual confirmation (user-driven)      |
| POST   | `/api/payments/ton/webhook`  | Render-facing TON webhook (secret req) |

Contracts live in `frontend/types/index.ts`. Update both client and server when adding fields.

---

## 6. Frontend Conventions

- All network calls go through `useApi` (`frontend/hooks/useApi.tsx`).
- `useAuth` manages session lifecycle — never mint IDs on the client.
- UI components come from `components/ui/*` (shadcn). Keep filenames and exports consistent.
- Toasts → `sonner`, icons → `lucide-react`, animations → `motion`.
- Tailwind theme resides in `frontend/tailwind.config.ts` and `styles/globals.css`.
- Maintain mobile-first layout (safe area, touch targets, haptics).

---

## 7. Backend Conventions

- Use `zod` for request validation (`backend/src/routes.ts`).
- DB access goes through `db.ts` (`query`, `withTransaction`).  
- Schema changes belong in `runSchemaMigrations`; update `user_tokens`, etc. responsibly.
- TON verification lives in `tonService.ts` — always confirm payments through it.
- Log with `console`; Render collects stdout/stderr.
- Return errors as `{ error: "message" }`.

---

## 8. Shared Config Rules

- `shared/config/ads.ts` — creatives and partner links.
- `shared/config/economy.ts` — boosts, energy rates, limits.
- `shared/config/partners.ts` — partner reward catalogue.

Any changes must stay backward compatible or be reflected on both front and back before merge.

---

## 9. Do & Don’t

**Do**
- Validate inputs on both sides.
- Keep PRs focused with descriptive commit messages (`feat: …`, `fix: …`).
- Update documentation (README, docs/DEPLOYMENT.md, this guide) when behavior changes.

**Don’t**
- Revert to Supabase/Deno or invent ad-hoc session logic.
- Alter `components/ui` structure or shared configs without consensus.
- Commit real `.env` files or secrets.
- Introduce external dependencies without review.

---

## 10. Testing & QA

No automated tests yet — run a manual smoke-test:
1. `npm run dev:backend` + `npm run dev:frontend`.
2. Request `/api/auth/anonymous` (browser console or frontend boot).
3. Walk through mining flow: watch → energy increase → stats update.
4. Issue partner reward claim.
5. Create boost order and confirm with a TON transaction (manual OK).
6. Hit `POST /api/payments/ton/webhook` with the shared secret to simulate a webhook.

Report findings in the project channel before merging significant changes.

---

## 11. Deployment Checklist (Vercel + Render + Neon)

1. **Neon** – create DB, copy pooled `DATABASE_URL` (with `sslmode=require`).
2. **Render** – Web Service:
   - Build `npm install && npm run build:backend`
   - Start `npm run start:backend`
   - Env vars from `backend/.env.example`
   - Health check `/api/health`
3. **Vercel** – Project:
   - Build `npm run build:frontend`
   - Output `frontend/dist`
   - Env var `VITE_BACKEND_URL`
4. Post-deploy smoke:
   - `/api/health`
   - `/api/auth/anonymous`
   - Mining + rewards flow
   - TON webhook test (`x-webhook-secret` header!)

Detailed instructions, screenshots, and FAQ → `docs/DEPLOYMENT.md`.

---

## 12. Roadmap (active items)

- **TON**: Automate payment verification (webhooks already available, integrate tonapi webhook flow).
- **Auth hardening**: Validate Telegram `initData`, adjust rate limits if needed.
- **Ads**: Integrate production network / mediation, expand analytics.
- **Admin**: Console for managing creatives, boosts, partners.

Discuss scope before starting any roadmap item.

---

## 13. Quick Checklist Before Committing

- `npm install --workspaces` after pulling new deps.
- Lint & format (respect existing config).
- Update docs when behavior changes (README, deployment guide, this handbook).
- Meaningful commit messages, English summaries.
- Open PR with testing notes, ensure CI (if enabled) is green.

Happy shipping! If something is unclear after reading this handbook and the deployment guide, raise it in the team channel before proceeding.
