# Cladhunter AI Operating Protocol (AIOP)

## Mission Context
- **Objective**: Deliver a mobile-first watch-to-earn simulator where users mine the 🆑 currency by watching ads, managing boosts, and interacting with TON payments.
- **Success Criteria**: Maintain a polished user experience, guarantee data consistency, and ensure the AI agent can deploy stable builds to production.

## System Overview
```
Frontend  : React 18 + TypeScript + Tailwind + Vite
Backend   : Node/Express API layer (serverless on Vercel)
Database  : MongoDB Atlas via Mongoose (URI provided through MONGODB_URI)
Hosting   : Vercel (frontend + serverless functions)
```
- **External Integrations**: TON Connect (wallet/boosts), ad providers (mocked), GitHub Actions for CI (optional).

## Data Layer Contract
- **Primary store**: MongoDB connected with Mongoose models inside `/src/server/db`.
- **Connection string**: `process.env.MONGODB_URI` (must be defined in all runtimes).
- **Collections**: `users`, `sessions`, `adLogs`, `boosts`, `rewards`. Schema files are authoritative; migrations are handled through Mongoose models.
- **No Supabase or Prisma usage**: remove legacy code when encountered.

## Code Authoring Rules
1. **Do modify** React components (`/components`, `/src`), serverless handlers (`/src/server`), hooks, utilities, and styles when necessary.
2. **Do not modify** `/guidelines`, `/Attributions.md`, or license metadata without product owner approval.
3. **Preserve** TypeScript strictness, lint configuration, and Tailwind class structure.
4. **Database access** must use existing Mongoose helpers; avoid ad-hoc Mongo queries.
5. **Secrets**: read from environment variables only—never hardcode keys.
6. **Testing**: add/update Vitest tests alongside code changes where possible.

## Collaboration & Delivery Flow
1. **Codex**
   - Use Codex instructions (this document) before each session.
   - Plan tasks, update AIOP notes if architecture changes.
2. **GitHub**
   - Commit atomic changes with descriptive messages.
   - Open pull requests summarizing scope, testing, and deployment impact.
3. **Vercel**
   - Main deployment target. Each PR should link to a Vercel preview.
   - Ensure environment variables (`MONGODB_URI`, `NEXT_PUBLIC_*`) are set in Vercel dashboard.
4. **Supabase**
   - Legacy provider; no active integration. If encountered, migrate or remove the reference.

## Initialization Checklist
1. Copy `.env.example` to `.env.local` (local dev) and `.env` (CI) when needed.
2. Provide values for:
   - `MONGODB_URI`
   - `TON_API_KEY` (if TON features enabled)
   - `VERCEL_ENV` (optional, used for logging)
3. Run `npm install`.
4. Start dev server with `npm run dev` and confirm MongoDB connection success message.

## Deployment Procedure
1. Merge changes to `main` via GitHub PR.
2. Confirm Vercel CI builds succeed and preview is healthy.
3. Promote preview to production in Vercel dashboard.
4. Monitor logs (`vercel logs`) and MongoDB Atlas dashboard for errors within first hour.

## AI Agent Behavior
- **Before coding**: review open issues, verify requirements, re-read this AIOP.
- **While coding**: keep diffs minimal, write comments only when logic is non-obvious, and update documentation if architecture changes.
- **After coding**: run `npm run lint` and `npm run test` (or explain why skipped), summarize changes, and prepare deployment notes.
- **On legacy artifacts**: replace Supabase/Prisma references with MongoDB equivalents and log removals in commit messages.

## Incident Response
- On build failure: reproduce locally, fix, re-run tests, update PR.
- On database outage: fail gracefully by surfacing maintenance banner; queue user actions locally until reconnection.
- On security concern: rotate affected credentials, document incident, and notify maintainers.

_Last reviewed: 2025-10-22_
