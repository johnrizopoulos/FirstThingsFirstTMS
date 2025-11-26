# First Things First - Task Management App

## Overview
A terminal-inspired task management web application with IBM 3270/Bloomberg aesthetic. Features Focus mode for single-task concentration, global task queue, milestone-based Kanban board (max 5 columns), 30-day trash retention, and a Completed view for permanently viewing completed tasks/milestones. Includes three theme modes: Terminal (green-on-black), Dark (light gray-on-black), and Light (black-on-white). Uses email + name passwordless authentication with PostgreSQL for data storage.

## Version 2.0 (Nov 26, 2025)

### Three-Page Authentication Flow
- Replaced Replit Auth with custom email + name passwordless authentication system
- Implemented three-page user journey:
  1. **Landing Page (/)** - Elaborate marketing page with multiple sections (Problem, Features, Terminal Design, Philosophy, Footer)
  2. **Login Page (/login)** - Brief page with key features and GET_AUTHENTICATED button
  3. **Sign In Page (/signin)** - Email + name form for actual authentication
- Added [SIGN IN] button to landing page (top left) for quick access to sign-in page
- Added [HOME] buttons to Login and Sign In pages (top left) to return to landing page
- Session-based authentication with httpOnly cookies, CSRF protection
- User data stored in PostgreSQL with consent tracking (consentTimestamp, consentPurpose, consentSource)
- Landing page hero section updated: "Just pure productivity." now appears on separate line in bold

### Authentication Technical Details
- Email is unique identifier with upsert on login
- Session cookies use httpOnly, secure (production), sameSite: 'lax'
- No password required - simplified authentication flow
- Fixed constant page reloading bug by using wouter's Redirect component instead of window.location.href
- Adjusted React Query settings: staleTime: Infinity, refetchOnWindowFocus: false

## Version 1.x Changes (Nov 26, 2025)

### Task Count Limit Per Milestone
- Implemented 10-task-per-milestone limit to enforce focus and prevent milestone bloat
- Backend validation in POST /api/tasks route returns 400 error "Milestone task limit (10) reached"
- Task count only includes active (non-deleted, non-completed) tasks
- Frontend will need to show error toast when limit is reached

### Character Limits & Dynamic Textarea
- Task and milestone titles limited to 250 characters with visible character count display
- Description and definition of done fields support multi-line text with `whitespace-pre-wrap` preservation
- Textarea height dynamically adjusts to fit content (max 300px with scrolling)

### Deployment Fixes & Error Handling
- Enhanced production server startup with comprehensive error handling and logging
- Added environment variable validation (DATABASE_URL, SESSION_SECRET)
- Improved server initialization logging to diagnose deployment issues
- Added error handlers for auth setup and database connection failures
- Server correctly configured to listen on 0.0.0.0:5000 (required for Autoscale)
- Production startup validates critical environment variables before initialization
- Updated auth setup to support both development (REPL_ID) and production (CLIENT_ID) environments
- REPL_ID is not available in Autoscale deployments - use CLIENT_ID instead

### Landing Page Enhancements
- Fixed blinking cursor div wrapping above "FIRST_THINGS_FIRST" title on narrow screens
- Removed `flex-wrap` class from title container to keep cursor always to the left of title
- Added "[ENTER] START_NOW" CTA buttons between each section (Problem, Features, Terminal Design, Philosophy)
- Converted theme names to interactive buttons that directly change the theme (Terminal, Dark, Light)
- Updated keyboard navigation list to show all 6 pages (F1-F6) including Trash and Tutorial
- Extended ThemeContext to support direct theme setting via `setTheme()` function

## Previous Changes (Nov 25, 2025)

### Task Creation Fix
- Fixed critical bug where new tasks weren't appearing in List view after creation
- Root cause: getTasks query used INNER JOIN on milestones, excluding tasks without milestones
- Solution: Added `userId` field to tasks table as primary ownership indicator
- Updated getTasks and getTask queries to filter by userId directly instead of joining through milestones
- Modified POST /api/tasks route to pass userId when creating tasks
- Database migration: Added user_id column to tasks table (truncated existing tasks due to NOT NULL constraint)

### Tutorial System Overhaul
- Tutorial page moved to dedicated `/tutorial` route accessible via [F6] hotkey or navigation
- Removed auto-onboarding for new users - they now go directly to Focus mode on first login
- Removed "BACK" button from tutorial - users navigate using only PREVIOUS/NEXT buttons
- PREVIOUS button only appears when not on first page
- On last page, NEXT button becomes CLOSE
- OnboardingProvider simplified to only manage context (no forced onboarding flow)

### Header Update
- Changed header text from "FIRST_THINGS_FIRST_SYS // V.1.0" to "FIRST_THINGS_FIRST_TMS" across all pages
- Removed "Bloomberg Terminal-inspired task prioritization" subtitle from home page

### Milestone Assignment System
- Made milestoneId optional - tasks can now have no assigned milestone
- "ASSIGNED MILESTONE" field in List view now shows dropdown with "-- NONE --" option
- Only active (non-deleted, non-completed) milestones displayed in dropdown
- Tasks without assigned milestones are not displayed on Board view
- Board view filters tasks by `t.milestoneId && t.milestoneId === milestone.id`
- New API endpoint: `/api/milestones/active` for fetching active milestones only

## Architecture

### File Structure
- `client/src/pages/` - React pages (FocusPage, ListPage, BoardPage, CompletedPage, TrashPage, OnboardingPage)
- `client/src/components/` - Reusable UI components with Layout container
- `client/src/contexts/` - Theme and Onboarding contexts
- `client/src/hooks/` - useData hook for API integration
- `server/storage.ts` - Database operations with Drizzle ORM
- `server/routes.ts` - API endpoints
- `shared/schema.ts` - Zod and Drizzle schemas

### Navigation System
- F1: Focus mode
- F2: List view
- F3: Board view
- F4: Completed view
- F5: Trash view
- F6: Tutorial (NEW)

### Theme System
- Terminal: Green-on-black (IBM 3270 style)
- Dark: Light gray-on-black
- Light: Black-on-white
- Toggle via button in header
- Uses CSS variables in HSL format
- Stored in localStorage

### Key Features
- Focus mode: Single task concentration with confetti on completion
- List view: Task queue with click-to-edit and tap-hold-to-reorder; optional milestone assignment
- Board view: Milestone-based Kanban (max 5 columns); only shows tasks with assigned milestones
- Cascade completion: Completing milestone auto-completes linked tasks
- 30-day trash retention with auto-purge
- Permanent completed task viewing

## Design Conventions
- Terminal aesthetic with IBM Plex Mono font
- Uppercase text throughout
- Interaction pattern: Click/tap to edit, tap-and-hold-and-move to reorder
- data-testid attributes on all interactive and display elements
- Modal forms use local state, save on dialog close or explicit button

## Database
- PostgreSQL with Drizzle ORM
- Schema in `shared/schema.ts`
- Migrations: `npm run db:push`
- milestoneId column in tasks table is now nullable (OPTIONAL)
- Tables: tasks, milestones, users, sessions

## User Preferences
- No automatic onboarding flow for new users
- Tutorial accessible on-demand via F6 hotkey or navigation
