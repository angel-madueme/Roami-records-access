# Roami — Records and Access Slice PRD

## 1. Overview
This is Assessment 4 of 4 in a Product Engineering Bootcamp: a records-and-access slice for Roami, a travel planning app. A signed-in user can create, view, and delete "Saved Places" — a lightweight record of a destination they're considering (name, a note, a status). The entire point of this assessment is proving that no user can ever reach another user's saved places, through any route, by any means.

This project began as a full copy of the Assessment 3 (AI Integration) project, with `.git` history removed and files flattened into this project's own root — not a nested copy. Both the complete authentication flow (from Assessment 1) and the complete AI itinerary-extraction flow (from Assessment 3, including Gemini, DeepSeek, and Unsplash integrations) are carried over and kept fully intact and functional. This is a deliberate choice, disclosed here per the same brief instruction that has governed reuse across every prior assessment ("reuse is not cheating; hiding it is"). The AI features are not part of this assessment's scope, are not extended or modified here, and are not what's being graded — they exist in the codebase simply because this project was built on top of a working prior slice rather than a fresh scaffold.

## 2. Goals
- Every "Saved Place" record is reachable only by the user who created it — never another user, through any request shape (a manipulated URL, a replayed request, a direct API call).
- Ownership is enforced by scoping every query to the authenticated user at the query level, never checked after the data is already fetched.
- No raw database identifier is ever exposed in a URL or in the interface.
- Every deletion is recorded in an audit trail before the record disappears.
- A measurable, documented reduction in query count across the three main actions (list, view, delete).

## 3. Tech stack
- Framework: Next.js, App Router
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL (a dedicated database for this project, separate from every prior assessment's)
- Auth/session: reused unchanged from Assessment 1 — full signup, email verification, signin, forgot/reset password, database-backed sessions.
- AI integration: reused unchanged from Assessment 3 (Gemini extraction, DeepSeek expansion, Unsplash photo lookup) — present in the codebase, out of scope for this assessment, not touched or extended.
- Validation: Zod
- Styling: Tailwind CSS

## 4. Auth and AI carryover (reused from Assessments 1 and 3)
Full authentication (signup, email verification, signin, forgot/reset password, session management, dashboard shell) is reused unchanged — a real user signs up and signs in normally, exactly as in Assessments 2 and 3. The complete AI itinerary-extraction flow from Assessment 3 (upload, Gemini extraction, DeepSeek expansion, Unsplash enrichment) is also carried over unchanged and remains fully functional in this codebase. Both are disclosed here explicitly. This assessment's own graded scope is limited entirely to the new "Saved Places" feature described below; the reused features are not re-tested, re-documented in depth, or modified as part of this assessment's work.

## 5. Screens in scope
- **Reused, unchanged:** signup, verify-email, signin, forgot-password, reset-password (all steps), account-created success screen, dashboard, the full "Create from notes" AI itinerary flow.
- **New — Saved Places screen** (not a modal — a real, addressable view reached from the dashboard's "Saved places" sidebar link): two states.
  - Empty state: "No saved places yet" with a "Save a place" button.
  - Populated state: a list of the signed-in user's saved places (destination name, a truncated note preview, a status badge), with "Save a place" still available. Each item is clickable.
- **New — Create form modal:** stacks over the Saved Places screen. Fields: destination name, note (optional), status (Wishlist / Planned / Visited, default Wishlist). "Save" and "Cancel" actions.
- **New — Detail view modal:** stacks over the Saved Places screen, opened by clicking a list item. Shows destination name, status, full note. Includes a "Delete" button.
- **New — Delete confirmation modal:** stacks over the Detail view modal. Confirms the destination name being deleted, warns the action can't be undone. "Delete" (destructive styling) and "Cancel" actions.

Per PRD-standard URL-state conventions already used in this codebase (Payments' Plans & Billing modal, the AI Integration flow's Create-from-notes modal), the Saved Places screen and its stacked modals are reachable via URL query parameters (e.g. `?view=saved-places`, `&action=create`, `&action=detail&ref=<publicId>`) so that navigation is fast (no full page reload) while every state remains addressable and bookmarkable, per the brief's explicit requirement.

## 6. Screens explicitly out of scope
No landing/marketing page. No editing of a saved place once created. No search, tags, sharing, or collaboration on saved places. No dashboard widgets beyond the existing sidebar entry point. Create, list, view, delete — that is all, per the brief's explicit scope limit.

## 7. User flow
1. A signed-in user clicks "Saved places" in the dashboard sidebar, landing on the Saved Places screen (empty or populated).
2. Clicking "Save a place" opens the create form modal. Submitting creates a new record, closes the modal, and returns to the (now-updated) Saved Places list.
3. Clicking any saved place in the list opens the detail view modal, showing its full information.
4. Clicking "Delete" in the detail view opens the delete confirmation modal, stacked on top.
5. Confirming deletion writes an audit record (who deleted what, when) as part of the same operation that removes the saved place, then closes both modals and returns to the updated (possibly now-empty) Saved Places list.
6. At every step, every server-side query used to fetch, create, or delete a saved place is scoped to the requesting user's own ID directly in the query — never fetched broadly and filtered afterward.

## 8. Engineering requirements
- Every query scoped to the authenticated user in the query itself (e.g. `WHERE userId = ? AND publicId = ?`), never checked after fetching.
- No raw database identifiers (Prisma's internal `id`) exposed in any URL or anywhere in the interface — saved places are referenced externally by a separate, non-sequential public identifier.
- An audit record written for every deletion, capturing who deleted what and when, persisted before or as part of the delete operation itself — never logged after the row is already gone.
- Conditional views with URL state, so navigation is fast but every view (list, create, detail, delete-confirm) is addressable via the URL.
- Correct status codes throughout: 401 for no valid session at all, 403 for a valid session attempting to access a record it doesn't own.
- A measured query count for each of the three main actions (list, view/detail, delete), documented with a stated reduction from the first working version to an optimized version.
- Database indexes on the columns actually filtered or sorted on (at minimum: `userId`, and the public identifier).
- Genuine empty states — no placeholder or fake data anywhere.

## 9. Data model (high level)
- **User** and **Session** — reused unchanged from Assessment 1.
- **ItineraryJob**, **Itinerary**, **ItineraryActivity** — reused unchanged from Assessment 3, out of this assessment's scope.
- **SavedPlace** — one row per saved destination: id (internal, never exposed), publicId (a short, random, non-sequential external identifier — the only identifier ever shown in a URL or the UI), userId (relation to User), destination (string), note (string, nullable), status (enum: WISHLIST, PLANNED, VISITED), createdAt, updatedAt.
- **DeletionAuditLog** — one row per deletion event: id, userId (who performed the deletion), savedPlaceId or its snapshotted identifying data (since the SavedPlace row will no longer exist after deletion — capture enough at delete time, e.g. the destination name and the original publicId, to make the audit record meaningful on its own), deletedAt.

## 10. Deliverables
The GitHub repository (`Roami-records-access`, separate git history from all three prior assessments); `DOCUMENTATION.md` at the repo root following the 8-section bootcamp template; a LinkedIn post, 200-400 words, teaching one concept from this build.

## 11. Resolved decisions
- **publicId format:** Generated with the `nanoid` library, 12 characters, alphanumeric. This is the only identifier for a `SavedPlace` ever exposed in a URL or the UI — the internal Prisma `id` is never sent to the client in any response.
- **Audit log schema:** `DeletionAuditLog` snapshots the identifying data directly into the audit row at delete time — `userId` (who deleted it), `destination` (the name, captured before deletion), `publicId` (the original public identifier, captured before deletion), `deletedAt`. This makes the audit record fully self-contained and readable on its own even after the `SavedPlace` row no longer exists, rather than depending on a foreign key to a row that's been deleted.
- **URL query-param scheme:** The Saved Places screen is reached at `/dashboard?view=saved-places`. Stacked states layer on top via additional params: `&action=create` for the create form modal, `&action=detail&ref=<publicId>` for the detail view modal, `&action=delete&ref=<publicId>` for the delete confirmation modal. Closing any modal removes its action/ref params via `router.replace`, returning cleanly to `?view=saved-places`.
- **Query count measurement:** The three main actions to measure are (a) listing all of a user's saved places, (b) fetching one saved place's detail by `publicId`, (c) deleting one saved place. The "first working version" baseline is whatever the initial naive implementation produces (to be measured once built); the documented reduction will show the actual before/after query count once indexes and any N+1 patterns are addressed.
- **Index definitions:** A unique index on `SavedPlace.publicId` (since it's the sole lookup key for the detail/delete actions), and an index on `SavedPlace.userId` (since every list query filters by it). `DeletionAuditLog` gets an index on `userId` for potential future audit lookups, though not required by any current query in this assessment's scope.
- **Attack-testing plan:** Two real user accounts, created through the actual reused signup flow. For each of the three routes (list, detail-by-publicId, delete-by-publicId), the audit table will record: the method and path, what was attempted (e.g. "User B requests User A's publicId directly via curl with User B's own session cookie"), the actual result, and pass/fail. Every route gets tested via at least direct API calls with a mismatched session/publicId combination, and via URL substitution in the browser where applicable.

