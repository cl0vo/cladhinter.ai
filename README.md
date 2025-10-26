# 🆑 Cladhunter

Cloud mining simulator where users earn energy by watching ads, unlock boosts with TON payments and manage their wallet activity in real time.

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

1. Copy the example environment file and add credentials.

   ```bash
   cp .env.example .env
   # Fill in Postgres connection, TON keys and secrets.
   ```

2. Install dependencies for the workspaces (generates a single lockfile at the repo root).

   ```bash
   npm install
   ```

3. Run the backend API.

   ```bash
   npm run dev:backend
   ```

4. In another terminal, run the frontend client.

   ```bash
   npm run dev:frontend
   ```

The frontend dev server proxies `/api/*` requests to the backend (`http://localhost:4000` by default). Adjust `VITE_BACKEND_URL` in `.env` if you host the API elsewhere.

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
| `npm run build` | Build the frontend bundle. |
| `npm run test` | Run Vitest suites (frontend-focused). |
| `npm run db:indexes` | Ensure Postgres tables/indexes (runs in the backend workspace). |

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

---

## Testing

The Vitest suite inside `frontend/tests` covers UI utilities and selected API flows by mocking backend models. Run `npm run test` from the repo root.

---

## License

Released under the [MIT License](./LICENSE).
