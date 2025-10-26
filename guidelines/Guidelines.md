# Cladhunter contributor guidelines

## Repository structure
- Keep UI code under `frontend/`, backend API code under `backend/`, and shared, read-only data under `shared/`.
- Shared configuration should never import React/DOM-specific utilities; expose plain objects or functions only.
- When touching both workspaces, update docs and scripts so the developer experience stays symmetrical.

## Coding principles
- Prefer composable hooks/components on the frontend. Extract reusable logic into `frontend/hooks` or `frontend/utils` instead of creating large components.
- Backend services (`backend/src/services/*`) should stay pure and testable. Move side effects (HTTP/IO) into dedicated helpers.
- Keep MongoDB schemas and TON proof validation logic well typed; extend the shared TypeScript definitions if new fields are added.

## Tooling
- Use the workspace scripts defined in the root `package.json` (`npm run dev:frontend`, `npm run dev:backend`, etc.).
- Run `npm run test` before submitting changes; Vitest covers shared config and critical API flows.
- Update the documentation (README, AUDIT, Attributions) whenever the behaviour or structure changes.

Happy hacking!
