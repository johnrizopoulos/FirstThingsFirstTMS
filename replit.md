# First Things First TMS

## Overview

"First Things First TMS" is a Task Management System (TMS) application. The project is in its early/initialized state with no code yet written. The name suggests a priority-focused task management tool — likely helping users organize and prioritize tasks based on importance and urgency (potentially inspired by Stephen Covey's priority matrix concept).

The application will need to be built from scratch. Core expected features include:
- Task creation, editing, and deletion
- Task prioritization and categorization
- User management
- Task status tracking

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

Since the project is empty, the following architecture is recommended as a starting point:

### Frontend
- **Framework**: React with TypeScript for a modern, type-safe UI
- **Styling**: Tailwind CSS for rapid, utility-first styling
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: React Query (TanStack Query) for server state, React hooks for local state

### Backend
- **Runtime**: Node.js with Express.js as the HTTP server framework
- **Language**: TypeScript for type safety across the full stack
- **API Style**: RESTful API endpoints under `/api/` prefix
- **Architecture Pattern**: Separation of routes, storage/data access, and shared schema types

### Data Storage
- **ORM**: Drizzle ORM for database schema definition and queries
- **Database**: To be determined — Drizzle supports PostgreSQL, SQLite, and others
- **Schema Location**: Shared schema definitions in a common location accessible by both frontend and backend (`shared/schema.ts`)

### Project Structure (Recommended)
```
/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.tsx
├── server/          # Express backend
│   ├── routes.ts
│   ├── storage.ts
│   └── index.ts
├── shared/          # Shared types and schema
│   └── schema.ts
└── package.json
```

### Authentication
- Session-based or JWT authentication to be implemented
- User login/registration flow needed to support multi-user task management

## External Dependencies

Since the project is empty, no third-party integrations are currently configured. The following are anticipated dependencies:

### Core Framework & Runtime
- **Node.js** — Server runtime
- **Express.js** — Backend web framework
- **React** — Frontend UI library
- **TypeScript** — Type safety for both frontend and backend
- **Vite** — Frontend build tool and dev server

### Database & ORM
- **Drizzle ORM** — Schema definition, migrations, and query building
- **Database driver** — To be added based on chosen database (e.g., `pg` for PostgreSQL, `better-sqlite3` for SQLite)

### UI & Styling
- **Tailwind CSS** — Utility-first CSS framework
- **shadcn/ui or Radix UI** — Accessible component primitives

### Validation
- **Zod** — Runtime schema validation, integrates well with Drizzle for shared type definitions

### Dev Tools
- **tsx / ts-node** — TypeScript execution for development
- **drizzle-kit** — Database migration CLI tool