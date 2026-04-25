# Upgrading Clerk safely (`@clerk/ui` + `@clerk/react`)

Our sign-in / sign-up modal is styled by mapping our `.ftf-clerk-*` classes
onto Clerk's internal element keys (see `client/src/lib/clerkAppearance.ts`).
Those element keys, and the underlying DOM/CSS structure of the bundled
`@clerk/ui` widget, are only guaranteed stable inside a single minor version
of `@clerk/ui`. Today our `package.json` declares:

- `@clerk/react` `^6.4.4`
- `@clerk/ui` `^1.6.6`  (passed via `<ClerkProvider ui={clerkUi} />` in
  `client/src/App.tsx`)

Note: these are caret ranges, not exact pins, so a fresh `npm install` can
pull in any newer minor version. Run this checklist whenever the resolved
version in `package-lock.json` changes, not just when `package.json` is
edited.

When a new `@clerk/ui` (e.g. `1.7.x` or `2.x`) ships, nothing in our app will
warn us automatically — but the modal can silently regress into a generic /
broken look. Use this checklist every time either Clerk package is bumped.

## Pre-merge checklist

1. **Bump versions in lockstep.** Update `@clerk/react` and `@clerk/ui`
   together in `package.json`. Never upgrade one without re-checking the
   other, even for a patch bump — Clerk publishes them in matched pairs.

2. **Reinstall and start the app.** Run a fresh install so the lockfile
   reflects the new versions, then start the dev workflow.

3. **Re-test all three themes on both modal pages.** For each theme
   (`terminal`, `dark`, `light`), open both `/sign-in` and `/sign-up` and
   confirm:
   - The terminal-style backdrop image renders behind the modal.
   - The card has the 2px primary-colored border, square corners, and no
     drop shadow.
   - The header title is uppercase, bold, monospace, primary-colored.
   - Social buttons (Google / Apple), the divider, the email/OTP input,
     the primary submit button, and the footer link all use the monospace
     font, square corners, and primary-colored borders.
   - The logo in the header matches the theme (terminal/dark share the
     neon-green mark; light uses the dark-green / cream variant).
   Switch themes from the app's theme toggle while a modal is open and
   confirm colors live-swap (they read `hsl(var(--*))` tokens).

4. **Verify the browser console is clean.** With each modal open, confirm
   there are no Clerk runtime warnings — in particular, watch for
   "Unknown appearance element key: …". Each such warning means an
   element key in `client/src/lib/clerkAppearance.ts` was renamed or
   removed in the new `@clerk/ui` and our override is now a no-op.

5. **Reconcile renamed / removed element keys.** If step 4 surfaces any
   warnings, or if step 3 shows an unstyled element, update
   `client/src/lib/clerkAppearance.ts`:
   - Find the new element key in the Clerk changelog / appearance docs
     for the version you are upgrading to.
   - Move the existing class string onto the new key.
   - If the underlying DOM also changed (e.g. a wrapper element was
     removed), update the matching `.ftf-clerk-*` rule in
     `client/src/index.css` so the layout still holds.

6. **Re-run the visual pass (step 3) once more** after any code changes,
   to confirm the fix didn't break a different theme.

7. **Commit the version bump and any appearance fixes together.** Don't
   land a Clerk bump without the corresponding `clerkAppearance.ts` /
   `index.css` updates — otherwise the next person to pull will see a
   regressed modal.

## Files to touch when reconciling a breaking change

- `client/src/App.tsx` — `ClerkProvider` wiring and the `ui={clerkUi}` prop.
- `client/src/lib/clerkAppearance.ts` — element-key → class-name map and
  `variables` (color tokens, font, border-radius).
- `client/src/index.css` — `.ftf-clerk-backdrop`, `.ftf-clerk-modal-content`,
  `.ftf-clerk-card`, and the logo image rule.
- `package.json` — the two pinned Clerk dependencies.

## When to schedule this check

- Any time Dependabot / `npm outdated` shows a new `@clerk/ui` or
  `@clerk/react` release, even a patch.
- Before every production deploy that includes a Clerk upgrade.
