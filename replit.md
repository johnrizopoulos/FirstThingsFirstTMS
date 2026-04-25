# First Things First TMS

## Overview

A terminal-inspired task management web application with IBM 3270/Bloomberg aesthetic. Features Focus mode for single-task concentration, global task queue, milestone-based Kanban board (max 5 milestones, max 10 tasks per milestone, max 50 tasks total), 30-day trash retention, and a Completed view for permanently viewing completed tasks/milestones. Includes three theme modes: Terminal (green-on-black), Dark (light gray-on-black), and Light (black-on-white). Uses Clerk social login (Google/Apple) for authentication with PostgreSQL for data storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## Maintenance docs

- [Upgrading Clerk safely (`@clerk/ui` + `@clerk/react`)](docs/clerk-upgrade.md) — checklist to follow before bumping either Clerk dependency, so the terminal-themed sign-in/sign-up modal doesn't silently regress.

---

<!--
  ============================================================
  CHECKPOINT: PRE-CLERK AUTHENTICATION TRANSITION
  Date: April 24, 2026
  Commit: b08a6a2a3c6a62f9ad928df917266beb1aca647a (published)
  ============================================================

  This marks the stable, published state of the application BEFORE
  migrating from the custom email+name passwordless auth system to
  Clerk (Google/Apple social login).

  Current auth system (to be replaced):
  - Custom email + name form (no password, no OTP)
  - Sessions managed by express-session + connect-pg-simple
  - Sessions stored in PostgreSQL `sessions` table
  - isAuthenticated middleware in server/auth.ts
  - useAuth hook fetches /api/auth/user to check login state
  - AuthRouter in App.tsx handles conditional routing

  All features below are complete and working at this checkpoint:
  - Focus mode, List view, Board view, Completed view, Trash
  - Remove All button in Trash (permanent delete)
  - Cascade milestone completion
  - 30-day auto-purge of trash
  - Three theme modes
  - Tutorial page (F6)
  - Performance optimizations (view-specific endpoints, background refetch)

  Task #1 (Replace auth with Clerk) is planned and ready to build.
  ============================================================
-->

---

## Version 2.4 (April 25, 2026)

### Offline mutation queue
- New `client/src/lib/offlineQueue.ts` — queues write operations attempted while `isOnline()` is false and replays them once connectivity returns. Backed by `localStorage` (key `fft.offlineMutationQueue.v1`) so queued changes survive a page reload, with safe fallbacks when storage is unavailable.
- `client/src/lib/api.ts` mutation helpers (create/update/complete/uncomplete/delete/reorder/restore for tasks and milestones, plus cleanup/empty trash) now go through `executeOrQueue`. Offline → enqueue and return a typed stub so the UI doesn't see an error toast. Online → call the real endpoint; if `fetch` itself throws a network-like error, the call is queued and the stub is returned.
- `client/src/components/OfflineBanner.tsx` registers handlers, calls `startQueueBridge()` (which auto-drains on reconnect), drains explicitly when the banner flips back to "online", and surfaces friendly toasts for `404/409/410` conflicts (the queued change is dropped instead of looping forever).
- **Owner-scoped queue** (cross-account safety): the queue is tagged with the Clerk user id under `fft.offlineMutationQueueOwner.v1`. `syncQueueOwner(userId)` is called from `OfflineBanner` *before* registering handlers or starting the bridge, and the bridge effect itself is gated on `useUser().isLoaded`. On a sign-in / sign-out / account-switch the persisted queue is dropped, so a backlog queued under user A can never replay against user B's session on the same browser.
- Drain handlers use `rawMutations` from `client/src/lib/api.ts` — fetch-only helpers that don't re-queue on transient network errors. This preserves strict FIFO order: a network drop during drain leaves the failed entry at the head of the queue instead of appending it to the tail.
- Tests: `client/src/lib/__tests__/offlineQueue.test.ts` (25 tests — persistence, ordered drain, FIFO regression on transient drain failure, conflict + network-error handling, concurrent drain protection, online-bridge auto-replay, `clearQueue`, and `syncQueueOwner` cross-account replay protection) and offline-queueing cases added to `client/src/lib/__tests__/api.test.ts` (104 passing tests total).

### Clerk Auth Branding & Theming
- **Themed modal**: `client/src/lib/clerkAppearance.ts` factory builds a Clerk `appearance` object driven by `hsl(var(--*))` CSS variables so the sign-in/sign-up modal tracks the active theme (terminal/dark/light) live. `ClerkWithTheme` wrapper inside `ThemeProvider` re-binds the appearance and the backdrop URL on theme change.
- **Hand-built SVG logo**: replaced AI-generated PNG logos at the top of the auth modal with `client/public/clerk/logo-terminal.svg` and `logo-light.svg` — pixel-perfect 5×7 grid wordmark with a SMIL-animated blinking cursor block. PNG fallbacks removed.
- **Explicit Clerk UI dependency**: added `@clerk/ui` (currently `^1.6.6`, caret-ranged) as an explicit project dependency and passed it via `<ClerkProvider ui={clerkUi}>` so the DOM structure our `.ftf-clerk-*` overrides target is no longer a transitive surprise from `@clerk/react`. Exact-version pinning is tracked separately as a follow-up task.
- **Upgrade checklist**: see [docs/clerk-upgrade.md](docs/clerk-upgrade.md) before bumping either Clerk package.

### Shareable Auth Pages
- New full-page routes registered in `App.tsx` `AuthRouter`:
  - `/sign-in` — `client/src/pages/SignInPage.tsx`
  - `/sign-up` — `client/src/pages/SignUpPage.tsx`
  - `/reset-password` — `client/src/pages/ResetPasswordPage.tsx` (drives Clerk's `resetPasswordEmailCode` flow: email → 6-digit code → new password → finalize)
- All three render with the FTF-branded backdrop, CRT overlay, and Plex Mono styling that matches the modal.
- Sign-in page links to `/reset-password` ("Forgot password?") and `/sign-up`.
- The standalone `/sign-in` page is a custom email + password form (not Clerk's prebuilt `<SignIn>`). The Landing-page modal still uses Clerk's prebuilt component, which can render configured social providers.

### Shared Header Component
- New `client/src/components/AppHeader.tsx` — fixed-position FTF wordmark on the left (links home) and theme cycle button on the right.
- Used by `LandingPage`, `SignInPage`, `SignUpPage`, and `ResetPasswordPage`. `LandingPage` overrides the left slot with its `[SIGN IN]` / `[SIGN UP]` buttons.

### Lockout Cool-down (rate-limit handling)
- New shared helper `client/src/lib/clerkRateLimit.ts`: detects Clerk rate-limit / lockout responses (`user_locked`, `too_many_requests`, HTTP 429, plus `lockout` / `rate_limit` / `too_many` substrings), formats countdowns, and persists active cool-downs to `localStorage` keyed by `clerk-cooldown:<flow>:<normalized-identifier>`.
- Applied on both `/sign-in` and `/reset-password`: the submit button disables itself and shows a friendly "Too many attempts. Try again in Xm Ys." banner with CTAs to reset password and contact support. Cool-down survives page reloads and is cleared at expiry.
- Defaults to a 5-minute cool-down when Clerk omits `retryAfter`.

### Configurable Support Email
- New `client/src/lib/support.ts` exporting `SUPPORT_EMAIL` (read from `VITE_SUPPORT_EMAIL`, default `support@firstthingsfirsttms.com`) and `supportMailtoHref(subject?)`.
- "Contact support" links surfaced on:
  - Logged-in app footer (`Layout.tsx`) — every authenticated route.
  - Landing page footer and `not-found.tsx`.
  - Sign-in / sign-up / reset-password pages (always visible, not just inside the lockout banner).
- Set `VITE_SUPPORT_EMAIL` to override.

### Brand Assets
- **Favicon / app icon set** (under `client/public/`): `favicon.svg` (dark + `favicon-light.svg` for light OS theme via `prefers-color-scheme`), 32×32 PNG fallback, 180×180 `apple-touch-icon.png`, 192×192 + 512×512 maskable Android icons, `icon-maskable.svg` source, and `site.webmanifest`. All built from the same hand-built FTF wordmark geometry as the Clerk modal logo.
- **Open Graph / Twitter Card**: regenerated `client/public/opengraph.jpg` (1200×630) with the FTF wordmark + tagline + scanlines on a near-black terminal background. `client/index.html` now sets absolute `og:image` / `twitter:image` URLs with width/height/type/alt. `vite-plugin-meta-images.ts` rewrites these to the live deployment domain (with `REPLIT_DOMAINS` fallback for production).

### Testing
- Added **vitest** as a dev dependency and wired `npm test` → `vitest run`.
- New `client/src/lib/__tests__/clerkRateLimit.test.ts` — 34 tests covering `detectRateLimit`, `formatCountdown`, and `describeError` (Clerk error shape parsing, retry-after fallbacks, edge cases).

### Reconciliation
- `scripts/post-merge.sh` runs `npm install` + `drizzle-kit push` after every task merge, registered with the platform via `setPostMergeConfig` (180s timeout). Verified end-to-end at ~12s.

---

## Version 2.3 — Stable / Published (April 24, 2026)

### Trash Page — Remove All Feature
- Added **REMOVE ALL** button to Trash page header
- Permanently deletes all trashed tasks and milestones in one action
- Button only appears when trash contains items
- Red/destructive styling with trash icon to indicate caution
- Backend: `emptyTrash()` storage method and `/api/empty-trash` endpoint
- Frontend: `useEmptyTrash()` hook with cache invalidation

## Version 2.2 (Nov 27, 2025)

### Performance Optimizations
- **View-Specific Endpoints**: Created dedicated API endpoints for each view
  - `/api/tasks/active` — Returns only active tasks (50–80% smaller payload)
  - `/api/tasks/focus` — Returns single top-priority task (99% smaller payload)
  - Updated FocusPage, ListPage, and BoardPage to use optimized endpoints
- **Background Refetch Strategy**: Replaced invalidateQueries with refetchQueries
  - Data stays in cache during refresh — instant page transitions
  - Zero loading spinners when navigating between views

### Completed View Fixes
- Added individual delete buttons next to UNCOMPLETE for tasks and milestones
- Added CLEAR ALL button to move all completed items to trash at once
- Fixed getCompletedTasks to show all completed tasks (removed broken INNER JOIN)
- Fixed getCompletedMilestones to exclude deleted milestones (added isDeleted=false filter)

### Bug Fixes
- Fixed List view reordering — cache updates now sync with all view-specific endpoints
- Fixed dev authentication bypass for task creation

## Version 2.0 (Nov 27, 2025)

### Performance & UX Improvements
- Removed N+1 query pattern from reorderTasks (50% fewer queries)
- Independent ordering systems: List view uses `globalOrder`, Board view uses `milestoneOrder`
- Board view task cards now match List view interaction pattern (grab dots, clickable title)
- Multi-layer security validation for milestone task reordering (user ownership, cross-column protection)

### Code Quality
- Fixed React Fragment console error in wouter Route components
- Removed 42 unused UI components and 141 npm packages (smaller bundle)
- Simplified session handling

### Database
- Added transactions to `completeMilestone` and `deleteMilestone` for atomicity

### UNCOMPLETE Feature
- Added UNCOMPLETE buttons to Completed page for tasks and milestones
- Respects limits: max 50 active tasks, max 5 active milestones
- Uncompleting a milestone does NOT uncomplete its associated tasks

## Version 1.x (Nov 25–26, 2025)

### Authentication
- Three-page auth flow: Landing → Login → Sign In
- Custom email + name passwordless authentication
- Session-based auth with httpOnly cookies
- User data stored in PostgreSQL with consent tracking

### Task & Milestone System
- 10-task-per-milestone limit enforced (backend + frontend)
- Max 5 active milestones, max 50 active tasks total
- Cascade completion: completing a milestone auto-completes linked tasks
- milestoneId optional — tasks can exist without a milestone
- Soft delete with 30-day trash retention and auto-purge

### UI & Design
- Terminal aesthetic — IBM Plex Mono font, uppercase text throughout
- Three theme modes: Terminal, Dark, Light (switchable from landing page and header)
- 250-character limit on task/milestone titles with visible count
- Dynamic textarea height for descriptions

### Tutorial System
- Tutorial page at `/tutorial` (F6 hotkey)
- No auto-onboarding — users go directly to Focus mode on first login

---

## Architecture

### File Structure
```
/
├── client/
│   ├── public/
│   │   ├── clerk/           — logo-terminal.svg, logo-light.svg (auth modal logos)
│   │   ├── favicon.svg, favicon-light.svg, favicon.png
│   │   ├── apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable.svg
│   │   ├── opengraph.jpg    — OG/Twitter social card
│   │   └── site.webmanifest
│   ├── index.html           — favicon links, OG/Twitter meta tags
│   └── src/
│       ├── components/      — Layout, AppHeader, UI primitives
│       ├── contexts/        — ThemeContext, OnboardingContext
│       ├── hooks/           — useData.ts, useAuth.ts
│       ├── lib/             — api.ts, clerkAppearance.ts, clerkRateLimit.ts (+ __tests__), support.ts
│       ├── pages/           — FocusPage, ListPage, BoardPage, CompletedPage, TrashPage, TutorialPage, LandingPage, SignInPage, SignUpPage, ResetPasswordPage, not-found
│       ├── App.tsx          — AuthRouter + ClerkWithTheme wrapper
│       └── main.tsx         — App entry point
├── server/
│   ├── auth.ts              — clerkMiddleware, isAuthenticated (syncs Clerk user to DB)
│   ├── routes.ts            — All API endpoints
│   ├── storage.ts           — Drizzle ORM database operations
│   └── index.ts             — Express server entry point
├── shared/
│   └── schema.ts            — Drizzle schema + Zod types (users, milestones, tasks)
├── docs/
│   └── clerk-upgrade.md     — pre-merge checklist for bumping @clerk/* packages
├── scripts/
│   └── post-merge.sh        — runs npm install + drizzle-kit push after task merges
└── package.json
```

### Navigation
- F1: Focus mode
- F2: List view
- F3: Board view
- F4: Completed view
- F5: Trash
- F6: Tutorial

### Theme System
- Terminal: Green-on-black (IBM 3270 style)
- Dark: Light gray-on-black
- Light: Black-on-white
- Stored in localStorage, toggled from header or landing page

### Database
- PostgreSQL via Replit's built-in database service
- Drizzle ORM for queries and schema management
- Tables: `users`, `milestones`, `tasks` (sessions are managed by Clerk; no local sessions table)
- Migrations: `npm run db:push`

### Authentication (Clerk)
- `main.tsx` validates `VITE_CLERK_PUBLISHABLE_KEY` and renders `<App />`. The actual `ClerkProvider` lives inside `client/src/App.tsx`, wrapped by `ClerkWithTheme` so the `appearance` object and the `--clerk-backdrop-url` CSS variable re-bind whenever the theme changes. The `@clerk/ui` bundle is passed in via the `ui` prop.
- `Show when="signed-in/out"` in `App.tsx` controls route access. Signed-out routes go through `AuthRouter`, which exposes `/`, `/sign-in`, `/sign-up`, and `/reset-password`.
- `useAuth` hook uses Clerk's `useUser()` — returns `{ user, isLoaded }`.
- **Landing page modal** uses `<SignInButton mode="modal">` (Clerk's prebuilt component, can render configured social providers).
- **Standalone `/sign-in` page** is a custom email + password form using `useSignIn()`. **`/sign-up`** uses Clerk's prebuilt component. **`/reset-password`** drives `resetPasswordEmailCode` end-to-end.
- All auth pages use the shared `AppHeader`, the FTF backdrop, and the rate-limit cool-down helpers.
- `Layout` uses Clerk's `signOut({ redirectUrl: "/" })` for logout.
- **Backend (`server/auth.ts`)**: `setupClerkMiddleware` is a no-op; auth runs per-request inside `isAuthenticated`. That middleware extracts a token from `Authorization: Bearer …` or the `__session` cookie, verifies it via custom JWT validation against Clerk's JWKS (`verifyClerkJwt`, with a 1-hour key cache), then looks the user up by `clerk_id`. On first hit it fetches the user from Clerk's Admin API and calls `storage.upsertUserByClerkId(clerkUserId, email, name)`. The `users.clerk_id` column links Clerk identity to the local user row.

### Environment variables
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk frontend key (required)
- `CLERK_SECRET_KEY` — Clerk backend key (required)
- `VITE_SUPPORT_EMAIL` — support email shown in footers and lockout banners (optional, defaults to `support@firstthingsfirsttms.com`)
- `DATABASE_URL` — PostgreSQL connection string (Replit DB)

### Key Design Conventions
- `data-testid` attributes on all interactive and display elements
- Modal forms use local state, save on dialog close or explicit button
- Interaction pattern: Click to edit, drag handle to reorder

---

## Planned Work

Active project tasks live in `.local/tasks/`. Task #1 (replace custom auth with Clerk) is complete. Open work currently includes follow-ups around Clerk visual-regression checks (#19), pinning Clerk to exact versions (#20), and storage-helper test coverage for the lockout cool-down (#29).
