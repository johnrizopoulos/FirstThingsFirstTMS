# Legacy Auth — Archived (Pre-Clerk)

This folder preserves the custom email + name passwordless auth system that was
in place before the Clerk migration (Task #1, April 25, 2026).

## Source
All files were extracted from commit `b08a6a2` ("Published your App"), the
last stable published state before the Clerk transition.

## Files (mirrored to original paths)

| Archive path | Original path | Purpose |
|---|---|---|
| `client/src/hooks/useAuth.ts` | `client/src/hooks/useAuth.ts` | Fetched `/api/auth/user` to get current user |
| `client/src/pages/LoginPage.tsx` | `client/src/pages/LoginPage.tsx` | Email + name landing form |
| `client/src/pages/SignInPage.tsx` | `client/src/pages/SignInPage.tsx` | Sign-in flow page |
| `server/auth.ts` | `server/auth.ts` | express-session + connect-pg-simple middleware, `/api/auth/login`, `/api/auth/logout`, `/api/auth/user` routes |

## How to restore (if ever needed)

1. Copy the four files back to their original paths (overwriting the Clerk versions)
2. Restore the deleted bits in related files:
   - `client/src/App.tsx`: re-add the custom `AuthRouter` (remove `<Show when="signed-in/out">`)
   - `client/src/main.tsx`: remove `<ClerkProvider>` wrapper
   - `client/src/components/Layout.tsx`: replace `<UserButton />` with the old `[LOGOUT]` button
   - `client/src/pages/LandingPage.tsx`: remove `<SignInButton>` / `<SignUpButton>`, restore old auth links
   - `server/routes.ts`: remove `/api/user/sync`, restore the `/api/auth/*` routes
   - `shared/schema.ts`: re-add the `sessions` table and the `jsonb` import
3. Reinstall dependencies: `express-session`, `connect-pg-simple`, `@types/express-session`, `@types/connect-pg-simple`
4. Remove `@clerk/react` if no longer needed
5. Drop `users.clerk_id` column (or leave it — it's nullable and harmless)
6. Recreate the `sessions` table with `npm run db:push`

## Why these are kept

The Clerk migration deletes the custom auth code from the active codebase, but
this archive lets us roll back the auth layer without searching git history if
Clerk ever needs to be removed or replaced.
