# Cladhunter – Developer Notes (MongoDB Edition)

## 🌐 Architecture Overview
- **Frontend:** React 18 + TypeScript, Tailwind, Motion, Recharts.
- **API Layer:** Vite dev middleware (`server/routes.ts`) exposing REST endpoints under `/api/*`.
- **Database:** MongoDB accessed via Mongoose models in `server/models/*` with business logic in `server/services/userService.ts`.

```
React Components / Hooks
        ↓ (fetch)
`/api/*` routes (server/routes.ts)
        ↓
Mongoose services (server/services/userService.ts)
        ↓
MongoDB (MONGOBASE_MONGODB_URI env)
```

## 📁 Key Directories
- `components/` – UI. `TodoList.tsx` now demonstrates user creation/listing via Mongo.
- `hooks/` – `useApi.tsx` wraps REST helpers from `utils/api/sqlClient.ts`.
- `server/` – Node-only code (models, services, middleware).
- `server/mongo.ts` – Shared MongoDB client + Mongoose connector. Requires `MONGOBASE_MONGODB_URI`.
- `utils/api/sqlClient.ts` – Fetch helpers used by React hooks/components.

## ⚠️ Development Guidelines
- Ensure `MONGOBASE_MONGODB_URI` is set (e.g. Atlas/Vercel integration string) before running `npm run dev`. Vite connects on startup via `vite.config.ts`.
- Server code runs in Node context only. Do **not** import `server/*` files into client bundles.
- API endpoints expect JSON bodies; handle errors by checking `{ error }` fields returned from middleware.
- Keep shared config (`config/economy.ts`, `config/partners.ts`) in sync with server logic.

## ✅ Sample Operations
- **Create user:** `await createUser({ userId: 'demo_1' })`
- **List users:** `await listUsersRequest()`
- Additional actions: `initUser`, `completeAdWatch`, `createOrder`, `claimReward`, etc. All map to routes defined in `server/routes.ts`.

## 🛠 Tooling
- `npm run dev` – Vite dev server + Mongo connection.
- `npm run build` / `npm run preview` – standard Vite pipeline (API middleware also mounted in preview).
- `npm run test` – Vitest (update/add tests under `tests/`).

Happy hacking! 🛠️
