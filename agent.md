# Cladhunter – Developer Notes

## 🌐 Architecture overview
- **Frontend (`frontend/`):** React 18 + TypeScript + Tailwind. Hooks in `frontend/hooks` call REST helpers from `frontend/utils/api/sqlClient.ts`.
- **Backend (`backend/`):** Standalone Node HTTP server exposing `/api/*` routes via middleware defined in `backend/src/routes.ts` and services in `backend/src/services/*`.
- **Shared (`shared/`):** Read-only configuration (ads, partners, economy) imported through the `@shared/*` alias from both workspaces.

```
React components/hooks
        ↓ (fetch)
frontend/utils/api/sqlClient.ts
        ↓
/api routes (backend/src/routes.ts)
        ↓
Mongoose services (backend/src/services/userService.ts)
        ↓
MongoDB (MONGOBASE_MONGODB_URI env)
```

## 📁 Key directories
- `frontend/components` – UI building blocks and screens.
- `frontend/hooks` – auth, TON connect, API data loaders.
- `backend/src/models` – MongoDB schemas.
- `backend/src/services` – business rules (ad rewards, boosts, ledger, wallet proof).
- `shared/config` – boost table, ad catalog, partner campaigns.

## ⚠️ Development checklist
- Copy `.env.example` to `.env` and configure MongoDB + TON secrets before running either workspace.
- Start the backend with `npm run dev:backend` so the frontend proxy can forward `/api` calls during local development.
- Avoid importing backend files into the frontend bundle; prefer API calls or shared config.
- Update documentation whenever you change behaviour affecting either workspace.

## 🛠 Tooling
- `npm run dev:frontend` – Vite dev server (proxies `/api` to backend).
- `npm run dev:backend` – Node HTTP server via `tsx` watch mode.
- `npm run db:indexes` – Create MongoDB indexes using backend scripts.
- `npm run test` – Vitest suite covering shared config and API flows (run from repo root).

Happy hacking! 🛠️
