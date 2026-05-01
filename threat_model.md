# Threat Model

## Project Overview

First Things First is a personal task-management web app with a React/Vite frontend and an Express backend backed by PostgreSQL via Drizzle ORM. Users authenticate with Clerk, then create, edit, complete, delete, restore, and reorder personal tasks and milestones. The production-relevant code is the Express API, Clerk token validation and user sync, the database storage layer, and the browser-side offline/PWA features that persist queued mutations.

## Assets

- **User accounts and sessions** — Clerk-issued session tokens and the local `users` table link between Clerk identities and local user rows. Compromise lets an attacker act as a user.
- **User task and milestone data** — titles, descriptions, completion state, deletion state, and ordering metadata in `tasks` and `milestones`. This is the application's primary private user data.
- **Application secrets** — `CLERK_SECRET_KEY` and `DATABASE_URL`. Exposure would enable administrative access to Clerk or direct database access.
- **Audit-adjacent operational data** — API responses and runtime logs can contain user data if the server logs response bodies. Leakage here exposes private task content outside the main app UX.
- **Browser-persisted offline state** — queued mutations stored in `localStorage` and app shell data stored by the service worker. This can survive reloads and account switches on the same device.

## Trust Boundaries

- **Browser to Express API** — every `/api/*` request crosses from an untrusted client into server-side business logic. The server must authenticate and authorize every request and treat request bodies as attacker-controlled.
- **Express API to PostgreSQL** — the server has direct write access to all user data. Missing ownership checks or unsafe updates here can become cross-user data access or integrity issues.
- **Express API to Clerk** — the backend fetches JWKS and Clerk user records with `CLERK_SECRET_KEY`. Token validation and first-login user sync depend on this boundary being handled correctly.
- **Authenticated user to other authenticated users' records** — the app is multi-user even though each user only manages personal data. Every task and milestone mutation must be scoped to the current local `userId`.
- **Online app to offline persistence** — browser-side queued mutations and cached shell assets persist across reloads and can survive sign-in / sign-out unless explicitly owner-scoped.
- **Production vs dev-only code** — `server/index-dev.ts`, test files, `_archived/`, and `.canvas/` are not production-reachable unless separately proven.

## Scan Anchors

- **Production entry points:** `server/index-prod.ts`, `server/app.ts`, `server/routes.ts`, `server/auth.ts`, `server/storage.ts`, `client/src/App.tsx`.
- **Highest-risk code areas:** Clerk token verification and user sync in `server/auth.ts`; ownership and update logic in `server/storage.ts`; raw request handling in `server/routes.ts`; offline queue + replay in `client/src/lib/offlineQueue.ts`; API call helpers in `client/src/lib/api.ts`; PWA cache logic in `client/public/service-worker.js`.
- **Public vs authenticated surfaces:** public pages are `/`, `/sign-in`, `/sign-up`, and `/reset-password`; all JSON API routes in `server/routes.ts` are intended to be authenticated.
- **Usually ignore as dev-only:** `server/index-dev.ts`, tests under `client/src/**/__tests__`, `_archived/`, `.canvas/`.

## Threat Categories

### Spoofing

The app relies on Clerk tokens to establish identity. The backend must only accept session tokens that are valid for this Clerk deployment, have not expired, and are bound to the expected issuer and authorized-party context. This matters more on shared-hosting parent domains such as Replit subdomains, where sibling origins can be same-site for cookie purposes. The backend must never trust client-supplied user IDs or frontend route gating as proof of identity.

### Tampering

Users can mutate tasks and milestones through many update endpoints, plus replay saved changes from the offline queue. The server must strictly validate which fields a client may change, prevent ownership fields from being reassigned, and ensure cross-entity references such as `milestoneId` stay within the current user's data set.

### Information Disclosure

Task and milestone content is private user data. API responses, client-side persistence, server logs, and error messages must avoid exposing another user's records, secrets, or sensitive operational details. Browser persistence should not let one signed-in user see or replay another user's saved changes on the same device.

### Denial of Service

The main production DoS risk is repeated authenticated mutation traffic, oversized or malformed request bodies, and dependency on Clerk/JWKS availability during authentication. The app should avoid making public unauthenticated endpoints expensive, and should fail closed without exposing internal details when auth backends are unavailable.

### Elevation of Privilege

The highest-impact failure mode is broken user scoping in the storage layer: a user must never read, modify, delete, restore, reorder, or reassign another user's tasks or milestones. All database updates must preserve tenant boundaries even if a malicious client submits unexpected fields or cross-user foreign keys.