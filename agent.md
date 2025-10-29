# Cladhunter – Developer Notes

## 🌐 Architecture overview
- **Frontend (`frontend/`)** – React 18 + TypeScript + Tailwind. Hooks in `frontend/hooks` call REST helpers from `frontend/utils/api/sqlClient.ts` and expect JSON payloads.
- **Backend (`backend/`)** – Standalone Node HTTP server exposing `/api/*` routes via middleware defined in `backend/src/routes.ts` and services in `backend/src/services/*`.
- **Shared (`shared/`)** – Read-only configuration (ads, partners, economy) imported through the `@shared/*` alias from both workspaces.

```
React components/hooks
        ↓ (fetch)
frontend/utils/api/sqlClient.ts
        ↓
/api routes (backend/src/routes.ts)
        ↓
Postgres-backed services (backend/src/services/*)
        ↓
Neon/PostgreSQL (DATABASE_URL env)
```

## 🧰 Local environment checklist
1. Copy `.env.example` to `.env` and replace placeholder TON + Postgres credentials. Both workspaces rely on the same env file.
2. Install dependencies from the repo root with `npm install` (single lockfile for the workspaces).
3. Start the backend first: `npm run dev:backend`. The API listens on `http://localhost:4000` by default.
4. Start the frontend in another shell: `npm run dev:frontend`. The Vite proxy forwards `/api/*` to the backend.
5. When adding tables or indexes, run `npm run db:indexes` after updating `backend/scripts`.

> Tip: if the frontend cannot reach the backend, check `VITE_BACKEND_URL` inside `.env`—the Vite proxy falls back to this value.

## 📁 Key directories
- `frontend/components` – UI building blocks and screens.
- `frontend/hooks` – auth, TON connect, API data loaders.
- `backend/src/services` – business rules (ad rewards, boosts, ledger, wallet proof).
- `backend/src/types` – shared TypeScript contracts for API responses.
- `shared/config` – boost table, ad catalog, partner campaigns.

## ✅ Quality and tooling
- `npm run lint` – Type-checks the frontend workspace.
- `npm run test` – Runs Vitest (frontend-focused integration and utility suites).
- `npm run build` – Generates the production frontend bundle.
- `npm run db:indexes` – Ensures required tables/indexes exist in Postgres.

Run `npm run lint && npm run test` before committing. Keep backend services pure and move IO to helpers for easier unit testing.

## 📝 Collaboration notes
- Update the README or guidelines whenever you change behaviour or add new environment variables.
- Avoid importing backend code into the frontend bundle; expose new data through REST endpoints or the shared config layer.
- Prefer extracting reusable logic into hooks/utilities instead of growing large components or services.
- When touching both workspaces, ensure types remain in sync—extend `backend/src/types` and reuse them in the frontend via the `@shared` alias when possible.

Happy hacking! 🛠️

## TON Connect integration (2025-10-29 refresh)
- **Source of truth:** `frontend/hooks/useTonConnect.tsx` owns connection state. It wraps `@tonconnect/ui-react`, requests `tonProof` payloads from `/api/wallet/proof/start`, forwards proofs to `/api/wallet/proof/finish`, and caches `{wallet,userId,token}` in `localStorage`.
- **UI surface:** `TonConnectButton` only consumes the hook (`status`, `wallet`, `error`, `connect`, `disconnect`). Reuse the same API for other screens instead of reading TonConnect UI state directly.
- **Backend verifier:** `backend/src/services/walletProofService.ts` stores proof sessions in Postgres, rebuilds the message per [docs.ton.org](https://docs.ton.org/v3/guidelines/ton-connect/verifying-signed-in-users), resolves the public key from `state_init` (or the live chain), and issues HMAC-signed access tokens persisted in `wallet_tokens`.
- **Domain safety:** the service normalises origins from `TON_PROOF_ALLOWED_DOMAINS`, CORS, manifest URLs and the request headers. The `/api/wallet/proof/start` handler adds the caller’s origin automatically, so you rarely need to touch envs outside production.
- **Session usage:** downstream APIs keep using `verifyAccessToken` and expect a bearer token. `useAuth` adapts the Ton Connect context into `{userId,address,token}` for the rest of the app.
