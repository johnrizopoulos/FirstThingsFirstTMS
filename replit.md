# First Things First TMS

## Overview

A terminal-inspired task management web application with IBM 3270/Bloomberg aesthetic. Features Focus mode for single-task concentration, global task queue, milestone-based Kanban board (max 5 milestones, max 10 tasks per milestone, max 50 tasks total), 30-day trash retention, and a Completed view for permanently viewing completed tasks/milestones. Includes three theme modes: Terminal (green-on-black), Dark (light gray-on-black), and Light (black-on-white). Uses email + name passwordless authentication with PostgreSQL for data storage.

## User Preferences

Preferred communication style: Simple, everyday language.

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
│   └── src/
│       ├── components/      — Layout, UI primitives
│       ├── contexts/        — ThemeContext, OnboardingContext
│       ├── hooks/           — useData.ts (all API mutations/queries), useAuth.ts
│       ├── lib/             — api.ts (fetch wrappers)
│       ├── pages/           — FocusPage, ListPage, BoardPage, CompletedPage, TrashPage, TutorialPage, LandingPage, LoginPage, SignInPage
│       ├── App.tsx          — AuthRouter, routing
│       └── main.tsx         — App entry point
├── server/
│   ├── auth.ts              — setupSession, handleLogin, handleLogout, isAuthenticated middleware
│   ├── routes.ts            — All API endpoints
│   ├── storage.ts           — Drizzle ORM database operations
│   └── index.ts             — Express server entry point
├── shared/
│   └── schema.ts            — Drizzle schema + Zod types (tasks, milestones, users, sessions)
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
- Tables: `tasks`, `milestones`, `users`, `sessions`
- Migrations: `npm run db:push`

### Authentication (Current — Pre-Clerk)
- Custom email + name passwordless login
- `express-session` + `connect-pg-simple` for session persistence
- `isAuthenticated` middleware protects all `/api/` routes
- `useAuth` hook fetches `/api/auth/user` to determine login state

### Key Design Conventions
- `data-testid` attributes on all interactive and display elements
- Modal forms use local state, save on dialog close or explicit button
- Interaction pattern: Click to edit, drag handle to reorder

---

## Planned Work

### Task #1 — Replace auth with Clerk (Draft)
Replace custom auth with Clerk for Google/Apple social login. See `.local/tasks/clerk-auth.md` for full implementation plan.
- Sign-up and sign-in remain web-browser only
- `VITE_CLERK_PUBLISHABLE_KEY` (frontend) and `CLERK_SECRET_KEY` (backend) required
- Uses `@clerk/react@latest` only
- `<ClerkProvider>` wraps app in `main.tsx`
- Uses `<Show when="signed-in/out">` — not the outdated `<SignedIn>/<SignedOut>` components
