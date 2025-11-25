# First Things First - Task Management App

## Overview
A terminal-inspired task management web application with IBM 3270/Bloomberg aesthetic. Features Focus mode for single-task concentration, global task queue, milestone-based Kanban board (max 5 columns), 30-day trash retention, and a Completed view for permanently viewing completed tasks/milestones. Includes three theme modes: Terminal (green-on-black), Dark (light gray-on-black), and Light (black-on-white). Uses Replit Auth for authentication and PostgreSQL for data storage.

## Recent Changes (Nov 25, 2025)

### Tutorial System Overhaul
- Tutorial page moved to dedicated `/tutorial` route accessible via [F6] hotkey or navigation
- Removed auto-onboarding for new users - they now go directly to Focus mode on first login
- Removed "BACK" button from tutorial - users navigate using only PREVIOUS/NEXT buttons
- PREVIOUS button only appears when not on first page
- On last page, NEXT button becomes CLOSE
- OnboardingProvider simplified to only manage context (no forced onboarding flow)

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
- List view: Task queue with click-to-edit and tap-hold-to-reorder
- Board view: Milestone-based Kanban (max 5 columns)
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
- Tables: tasks, milestones, etc.

## User Preferences
- No automatic onboarding flow for new users
- Tutorial accessible on-demand via F6 hotkey or navigation
