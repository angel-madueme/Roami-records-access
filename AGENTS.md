# Project

Roami's records-and-access slice — Assessment 4 of a Product Engineering Bootcamp. A signed-in user creates, views, and deletes "Saved Places," with the entire assessment graded on proving no user can ever reach another user's records. This project started as a full copy of Assessment 3, reusing both the complete authentication flow and the complete AI itinerary-extraction flow wholesale — neither is this assessment's scope, both are disclosed as carried over per docs/PRD.md Section 4. docs/PRD.md is the source of truth for scope and decisions — if any instruction conflicts with it, flag the conflict instead of proceeding.

# Stack

- Framework: Next.js, App Router
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL (a dedicated database for this project, separate from every prior assessment's)
- Auth/session: reused unchanged from Assessment 1 — full signup, email verification, signin, forgot/reset password, database-backed sessions
- AI integration: reused unchanged from Assessment 3 (Gemini extraction, DeepSeek expansion, Unsplash photo lookup) — present in the codebase, out of scope for this assessment, not touched or extended
- Validation: Zod
- Styling: Tailwind CSS

# Auth and AI carryover

The full authentication flow and the full AI itinerary flow (Gemini, DeepSeek, Unsplash) are both reused unchanged from prior assessments. Neither is touched, extended, or re-tested as part of this assessment's work — they exist in this codebase only because this project was built on a working prior slice.

# Hard rules — never violate these

- Never build a landing page or marketing page.
- Never add editing, search, tags, sharing, or collaboration to Saved Places, and never add dashboard widgets beyond the existing sidebar entry point — create, list, view, delete is the entire scope, per PRD Section 6.
- Every database query touching a SavedPlace row must scope by the authenticated user's ID directly in the query itself (e.g. a Prisma where clause combining userId and publicId together) — never fetch a row first and check ownership afterward in application code.
- The internal Prisma id for a SavedPlace is never sent to the client in any API response and never appears in any URL. The only identifier ever exposed externally is publicId, a 12-character nanoid-generated string.
- Every deletion writes a DeletionAuditLog row (userId, destination, publicId, deletedAt) as part of the same operation that deletes the SavedPlace — the audit write must happen before or atomically with the delete, never after, and must snapshot the identifying data directly rather than relying on a foreign key to the now-deleted row.
- The Saved Places screen and its three modal states (create, detail, delete-confirm) are addressable via URL query params exactly as defined in PRD Section 11 (?view=saved-places, &action=create, &action=detail&ref=<publicId>, &action=delete&ref=<publicId>) — every state must be reachable by URL, not just by in-app navigation.
- Use 401 for no valid session at all; use 403 for a valid session attempting to access a SavedPlace it doesn't own. Never conflate these two cases under one status code.
- SavedPlace.publicId carries a unique index; SavedPlace.userId is indexed for the list query. DeletionAuditLog carries an index on userId.
- Query counts for the three main actions (list, detail, delete) must be measured and documented with a real before/after comparison, per PRD Section 11 — not asserted without evidence.
- Attack testing must follow PRD Section 11 with two real user accounts created through the reused auth flow, testing list, detail-by-publicId, and delete-by-publicId via mismatched sessions and direct API / URL substitution.

# Documentation

DOCUMENTATION.md lives at the repo root, 8 sections in order: What This Is, How To Run It, The Flow Step By Step, The Data Model, The Concepts, What Went Wrong, What This Slice Does Not Handle, If I Built This Again. Update it incrementally as each piece is built, not all at the end. Section 1 must state explicitly that both the auth and AI flows were fully reused from prior assessments, per the brief's own instruction that reuse must be disclosed. The required Section 5 concepts for this assessment are: authentication versus authorization, scoping the query versus checking after the fetch, insecure direct object references, why raw database identifiers are not exposed, audit logging, page architecture (conditional rendering with URL state), status codes (401 vs 403), database indexing, and query count as a cost with real before/after numbers — every one of these needs its own four-question subheading (What it is, Why it's needed, How I implemented it, What I chose against).

# Workflow

- Commit after every completed task, not just at major milestones — this project's commit history must show incremental work from the first commit.
- Before implementing a new piece, state which file(s) you're about to touch and why, in one sentence.
- If any instruction — from me, in a later prompt, or inferred from a design reference — conflicts with docs/PRD.md or this file, stop and flag the conflict instead of proceeding.
