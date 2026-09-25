# Project

Roami’s AI integration slice is a single upload-to-result-to-expand flow: a user uploads messy trip notes, the app extracts a structured itinerary through Gemini vision, and the user can optionally expand it through DeepSeek. This project started as a full copy of Assessment 1, with authentication flattened into this project’s own root; there is no nested repository and no shared Git history. The complete authentication flow is reused rather than stripped down. `docs/PRD.md` is the source of truth for scope and decisions; if any instruction conflicts with it, flag the conflict instead of proceeding.

# Stack

- Framework: Next.js, App Router
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL, using a dedicated database for this project separate from Assessment 1 and 2’s
- Vision/extraction model: Gemini 3 Flash Preview (`gemini-3-flash-preview`) through Google’s official Gemini SDK. Gemini 2.5 Flash was the original plan, but it is inaccessible to new API keys as of this build; this is Google’s documented direct replacement.
- Text/follow-up model: DeepSeek V4.1 Flash using the current API identifier `deepseek-flash`, through the official OpenAI SDK pointed at `api.deepseek.com`; DeepSeek’s API is OpenAI-compatible
- Image search: Unsplash API for destination photos
- Validation: Zod for validating structured output from both models before it is trusted or stored
- Styling: Tailwind CSS
- Auth/session: database-backed sessions reused unchanged from Assessment 1, including the full signup, email-verification, signin, forgot/reset-password flow

# Auth carryover

Per PRD Section 4, the full authentication flow is reused unchanged from Assessment 1: signup, email verification, signin, forgot/reset password, session management, and the dashboard shell. It is not simplified and it is not seeded; a real user signs up and signs in normally.

# Hard rules — never violate these

- Never build a landing page or marketing page.
- Never add editing, sharing, exporting, or multi-itinerary management. Build only the one upload-to-result-to-expand flow specified in PRD Section 6.
- Use official SDKs only: Gemini through Google’s official SDK; DeepSeek V4.1 Flash through the official OpenAI SDK pointed at `api.deepseek.com`, because DeepSeek’s API is OpenAI-compatible. Document this explicitly wherever DeepSeek is called.
- API keys (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `UNSPLASH_ACCESS_KEY`) are written into `.env` by hand by the user. Never generate or guess them. `.env.example` carries commented placeholders only.
- Keep every changeable value in one configuration file/module, never inline in a route handler: model identifiers, timeouts, output-token caps, temperature, rate limits, and concurrency.
- Request structured output from both Gemini and DeepSeek with an explicit schema and validate it with Zod in application code on receipt. Never trust a 200 response on its own. Retry once with the same input only when a successful response fails schema validation; do not retry on timeout or provider error. If the retry also fails validation, mark the job `FAILED` and record the validation error in `errorMessage`.
- Create one database job record for every upload, holding `status` (`PENDING`, `PROCESSING`, `DONE`, or `FAILED`), `attempts`, and `errorMessage`.
- Run no more than 2 Gemini extraction calls concurrently, enforced by an in-memory counter. A 3rd simultaneous upload waits in a simple queue rather than firing immediately.
- Enforce the PRD rate limits: the upload/extraction-trigger endpoint allows 5 requests per user per 10 minutes; the expand-action endpoint allows 10 requests per user per 10 minutes. Both return `429` with a retry indication.
- Store uploaded images on the local filesystem, documented as the local-development equivalent of real object storage. Store only the storage key/path in the database, never raw file bytes.
- Apply a 30-second timeout to each Gemini call and a 20-second timeout to each DeepSeek call. On timeout, mark the job `FAILED` with `errorMessage` exactly: `The AI service took too long to respond. Please try again.` Do not automatically retry a timeout.
- Unsplash failures or empty results must never fail the overall extraction. The itinerary succeeds without a photo in that case.
- Handle failure gracefully at every step of the upload-to-result path. Never show a blank page or leave an unhandled 404.
- Trigger the background job with an async function immediately after the upload endpoint responds. Do not add a separate queue library or external service such as Redis or BullMQ. Jobs in flight do not survive a server restart; this is a known limitation and must be documented in Section 7.
- Do not implement a hard spend cap for this assessment. The PRD rate limits are the practical ceiling on spend in a given window.

# Documentation

`DOCUMENTATION.md` lives at the repository root with these eight sections, in order: What This Is, How To Run It, The Flow Step By Step, The Data Model, The Concepts, What Went Wrong, What This Slice Does Not Handle, If I Built This Again. Update it incrementally as each piece is built, not all at the end. Section 1 must explicitly state that the full authentication flow was reused from Assessment 1, per the brief’s instruction that reuse must be disclosed. Section 7 must explicitly state that background jobs do not survive a server restart because no external queue is used, per the resolved decision in PRD Section 11.

# Workflow

- Commit after every completed task, not just at major milestones; the project’s commit history must show incremental work from the first commit.
- Before implementing a new piece, state which file(s) you are about to touch and why, in one sentence.
- If any instruction—from the user, a later prompt, or inferred from a design reference—conflicts with `docs/PRD.md` or this file, stop and flag the conflict instead of proceeding.
