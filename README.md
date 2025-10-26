# 🆑 Cladhunter

Cloud mining simulator where users earn energy by watching ads, unlock boosts with TON payments and manage their wallet activity in real time.

> **Why this document exists:** new contributors often jump between the frontend and backend. The sections below outline the fastest way to boot the project locally, the commands to run, and the guardrails that keep the codebase healthy.

---

## Monorepo layout

```
cladhunter.ai/
├── frontend/   React + Vite client (hooks, components, UI assets)
├── backend/    Node API (Postgres queries, TON wallet proof, scripts)
├── shared/     Read-only config shared by both apps (ads, partners, economy)
└── package.json  Workspace scripts for running both sides
```

* **Frontend** – React 18, TypeScript, Tailwind, Radix UI primitives and Motion for interactions. Fetch helpers live in `frontend/utils/api` and assume the API is reachable via `/api/*`.
* **Backend** – Headless HTTP server exposing REST endpoints, backed by PostgreSQL. Wallet proof flows rely on TON SDK utilities.
* **Shared** – Source-of-truth configuration (boost tiers, ad catalog, partner campaigns) consumed by both the UI and the API.

---

## Quick start

1. **Prerequisites** – Node.js 20+ and npm 10+. Install [pnpm](https://pnpm.io) only if you prefer it locally; the repo is configured for npm workspaces.
2. **Copy the environment file** and add credentials:

   ```bash
   cp .env.example .env
   # Fill in Postgres connection strings, TON keys and secrets.
   ```

3. **Install dependencies** at the repo root. This installs both workspaces using a single lockfile.

   ```bash
   npm install
   ```

4. **Run the backend API** (start this first so the frontend proxy can reach it).

   ```bash
   npm run dev:backend
   ```

5. **Run the frontend client** in another terminal tab/window.

   ```bash
   npm run dev:frontend
   ```

The frontend dev server proxies `/api/*` requests to the backend (`http://localhost:4000` by default). Adjust `VITE_BACKEND_URL` in `.env` if you host the API elsewhere. When adding database indexes or tables, execute `npm run db:indexes` once the backend is running to keep Postgres in sync.

---

## Feature highlights

- 🎯 **Ad-based mining:** watch creatives to earn energy rewards tied to boost multipliers.
- ⚡ **Boost marketplace:** purchase time-limited multipliers via TON payments.
- 🤝 **Partner quests:** curated partner actions yield additional energy payouts.
- 📊 **Realtime stats:** ledger history and aggregate metrics synced from PostgreSQL.
- 🔐 **TON wallet proof:** wallet ownership verified through signed payloads before rewards unlock.

---

## Key scripts

| Command | Description |
| --- | --- |
| `npm run dev:backend` | Start the API with auto-reload via `tsx`. |
| `npm run dev:frontend` | Launch Vite + React frontend with proxy to the API. |
| `npm run build` | Build the production frontend bundle. |
| `npm run lint` | Type-check the frontend workspace (`tsc --noEmit`). |
| `npm run test` | Run Vitest suites (frontend-focused utilities and API contract checks). |
| `npm run db:indexes` | Ensure Postgres tables/indexes (runs in the backend workspace). |

Run `npm run lint && npm run test` before opening a pull request to catch type and behavioural regressions early.

---

## Architecture

```
React components/hooks  →  fetch helpers (/api/*)  →  Backend routes  →  Postgres services  →  Neon/PostgreSQL
                                                     │
                                                     └── TON SDK for wallet proof & payment reconciliation
```

- Backend routes live in `backend/src/routes.ts` and compose middleware-style handlers.
- Domain logic is stored under `backend/src/services/*` with SQL access helpers in `backend/src/postgres.ts`.
- Frontend fetch helpers reside in `frontend/utils/api/sqlClient.ts` and expect JSON responses.
- Shared configuration is imported from `@shared/config/*` (see `frontend/tsconfig.json` for alias setup).

---

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Primary Postgres connection string (Neon pooled endpoint recommended). |
| `DATABASE_URL_UNPOOLED` | Optional direct Postgres endpoint for scripts/background jobs. |
| `SERVER_HMAC_SECRET` | Secret used to sign TON proof nonces. |
| `TON_PROOF_ALLOWED_DOMAINS` | Comma-separated domains accepted in TON proof payloads. |
| `TON_MAINNET_RPC` | TON RPC endpoint used to verify wallet state. |
| `VITE_TON_MANIFEST` | URL to the TON Connect manifest for the frontend. |
| `VITE_BACKEND_URL` | Override proxy target for the frontend dev/preview servers. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the backend API. |

Keep `.env.example` in sync whenever you add or rename variables. Document the change in this table and in `agent.md` so new contributors avoid configuration drift.

---

## Testing & linting

- **Unit/integration tests:** `npm run test` (Vitest). Uses mocked backend models to verify shared config and API flows.
- **Type safety:** `npm run lint` (TypeScript `--noEmit`). Fix reported paths in the respective workspace before committing.
- **End-to-end flows:** manual for now—exercise wallet proof and boost purchases locally before major releases.

When backend response shapes change, update `backend/src/types`, refresh any mocks under `frontend/tests`, and mirror the changes in the shared config to keep both sides aligned.

---

## Troubleshooting

- **Frontend cannot reach the API:** ensure `npm run dev:backend` is running and that `VITE_BACKEND_URL` matches the backend port. Configure the variable in Vercel preview environments as well.
- **Database indexes missing:** run `npm run db:indexes` after changing backend scripts, then restart the backend server.
- **Type errors on import:** keep shared types under `backend/src/types` or `shared/` and import via the configured aliases (for example `@shared/config`). This prevents bundling backend-only modules into the frontend build.

---

## License

Released under the [MIT License](./LICENSE).
