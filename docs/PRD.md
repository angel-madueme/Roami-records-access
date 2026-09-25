# Roami — AI Integration Slice PRD

## 1. Overview
This is Assessment 3 of 4 in a Product Engineering Bootcamp: a single AI-powered flow for Roami, a travel planning app. A user uploads a photo of messy trip notes (handwritten notes, a screenshot, a booking confirmation), a background job processes it through a real AI model, and a structured itinerary appears — destination, dates, and a categorized list of activities. One follow-up action lets the user expand the itinerary with more suggested detail.

This project began as a full copy of the Assessment 1 authentication project, with its `.git` history removed and its files flattened into this project's own root — not a nested copy. The full authentication flow (signup, email verification, signin, forgot/reset password, and the dashboard shell) is reused and kept exactly as built, per the brief's explicit allowance: "No account system beyond what is needed to have a user, and reusing Assessment 1 is fine." This is a deliberate choice to have a real, self-created account rather than a seeded test user, and is disclosed here per the same brief instruction that governed Assessment 2's reuse.

Deliberately not included: no editing, sharing, or exporting of the generated itinerary. No saving multiple itineraries or any trip-management functionality beyond this one upload-to-result flow. No landing or marketing page.

## 2. Goals
- A single, complete AI flow: upload → background job → structured result → one follow-up action.
- Genuine use of two different models, each doing the part it's actually suited for, not two prompts on one model used interchangeably.
- Structured, validated output at every stage — no free text the application has to parse or guess at.
- Honest failure handling: a failed extraction is shown truthfully, not hidden or silently retried without the user knowing.

## 3. Tech stack
- Framework: Next.js, App Router
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL (a dedicated database for this project, separate from Assessment 1 and 2's)
- Vision/extraction model: Google Gemini 3 Flash Preview (`gemini-3-flash-preview`, official Google SDK), chosen for its multimodal vision capability — it reads the uploaded photo directly and returns structured JSON. Gemini 2.5 Flash was the original plan, but it was inaccessible to new API keys as of this build; Gemini 3 Flash Preview was substituted as Google’s documented direct replacement.
- Text/follow-up model: DeepSeek V4.1 Flash, called with the current API identifier `deepseek-flash` via the official OpenAI SDK pointed at DeepSeek's API endpoint (DeepSeek's API is OpenAI-compatible) — chosen because the follow-up action is text-only and doesn't need vision, so a separate, simpler model handles it.
- Image search: Unsplash API, used to fetch a real photo matching the extracted destination name. This is not an AI model call — it's a straightforward search-and-fetch, used to add a genuine, non-AI third-party API integration to the build, disclosed here as a deliberate learning choice beyond the assessment's minimum requirement.
- Validation: Zod, for validating structured output from both models before it's trusted or stored.
- Styling: Tailwind CSS
- Auth/session: reused unchanged from Assessment 1 — database-backed sessions, full signup/verify/signin/reset flow.

## 4. Auth carryover (reused from Assessment 1)
The full authentication flow is reused as-is: signup, email verification (via Nodemailer), signin, forgot/reset password, session management, and the dashboard shell. Nothing about auth was stripped down or simplified for this assessment — a real user signs up and signs in normally, rather than using a seeded test account. This exceeds what the brief requires ("no account system beyond what is needed to have a user") as a deliberate choice for a more complete, portfolio-consistent experience across all four assessment slices.

## 5. Screens in scope
- **Reused from Assessment 1:** signup, verify-email, signin, forgot-password, reset-password (all steps), account-created success screen, dashboard.
- **New — Upload:** a drop zone for a single image (JPG/PNG, size-limited), with a file preview once selected, and an "Extract itinerary" button.
- **New — Processing:** an honest status display (pending → processing → done/failed), no fake instant resolution.
- **New — Result:** the structured itinerary — a destination photo (from Unsplash, with attribution overlay) if one was found, destination name, date range, and a categorized activity list (each with an icon matching its category: transport, lodging, food, sightseeing, and a default for anything else). Includes the "Expand this itinerary" button.
- **New — Result, no image found:** the same result screen with the photo/attribution area simply omitted — no broken-image placeholder, the layout adapts cleanly.
- **New — Failed:** a clear failure state (red circular badge, honest message, "Try again" button returning to upload).

## 6. Screens explicitly out of scope
No landing/marketing page. No editing of the extracted itinerary. No saving, sharing, or exporting. No multi-itinerary history or management. No functionality beyond the one upload-to-result-to-expand flow, reached from the dashboard.

## 7. User flow
1. Signed-in user (via the reused auth flow) reaches the dashboard and navigates to the itinerary-extraction flow.
2. Uploads a photo of trip notes on the Upload screen. Client-side checks confirm file type and size before submission.
3. Submission creates a job record (status: PENDING → PROCESSING) and returns immediately — the request is not blocked waiting for the AI call to finish.
4. A background process picks up the job, sends the image to Gemini with a structured-output schema request (destination, start date, end date, activities — each with a category and title/note).
5. Gemini's response is validated against the expected schema in application code. If valid, the job is marked DONE with the structured result attached. If invalid or the model call fails, the job is marked FAILED with a recorded error message.
6. In parallel or immediately after a successful extraction, the destination name is used to query Unsplash for a matching photo. If found, it's attached to the result; if not, or if the Unsplash call fails, the result proceeds without an image — this never blocks or fails the itinerary extraction itself.
7. The user sees the Processing screen update to the Result screen once the job resolves, showing the structured itinerary.
8. The user may click "Expand this itinerary," which sends the structured result to DeepSeek with a distinct system prompt (the second role) requesting expanded detail on the existing activities. The response is validated and the activity list updates in place.
9. If the extraction job fails, the user sees the Failed screen with an honest message and a way to retry.

## 8. Engineering requirements
- Official SDKs only for both Gemini and DeepSeek — DeepSeek accessed via the official OpenAI SDK pointed at its compatible endpoint, documented as such.
- API keys (Gemini, DeepSeek, Unsplash) written into `.env` by hand, never by the agent, with `.env.example` carrying commented placeholders.
- A configuration file/module holding every changeable value: model identifiers, timeouts, output token caps, temperature, rate limits, and concurrency — not hardcoded inline in route handlers.
- A written system prompt per model role (Gemini's extraction role, DeepSeek's expansion role), with each parameter justified in the documentation.
- Structured output requested with an explicit schema from both models, validated in application code (Zod) on receipt — never trusted on the strength of the model returning a 200 response alone. A defined retry and a defined graceful failure for invalid output.
- A job record in the database for each upload, holding status, attempts, and the error message on failure.
- A concurrency cap so multiple simultaneous uploads don't fire unlimited simultaneous Gemini calls.
- Rate limiting on the upload/processing-trigger endpoint and on the "Expand this itinerary" follow-up endpoint.
- Uploaded images stored in a local filesystem folder (documented explicitly as the local development equivalent of real object storage) — only the storage key/path is held in the database, never the raw file bytes.
- A timeout on every model call (both Gemini and DeepSeek), with a defined fallback/failure behavior if exceeded.
- Unsplash API failures or empty results are handled gracefully and never surface as a failure of the overall extraction — the itinerary still succeeds without a photo.

## 9. Data model (high level)
- **User** and **Session** — reused unchanged from Assessment 1.
- **ItineraryJob** — one row per upload: id, userId, status (PENDING/PROCESSING/DONE/FAILED), attempts, errorMessage (nullable), storageKey (path to the uploaded image on local disk), createdAt, updatedAt.
- **Itinerary** — the structured result of a successful job: id, jobId (relation), destination, startDate, endDate, unsplashImageUrl (nullable), unsplashPhotographerName (nullable), unsplashPhotographerUrl (nullable), createdAt, updatedAt.
- **ItineraryActivity** — one row per extracted activity: id, itineraryId (relation), category (enum: TRANSPORT, LODGING, FOOD, SIGHTSEEING, OTHER), title, note, order (integer, to preserve display sequence).

## 10. Deliverables
The GitHub repository (`Roami-ai-integration`, separate git history from Assessment 1 and 2); `DOCUMENTATION.md` at the repo root following the 8-section bootcamp template; a LinkedIn post, 200-400 words, teaching one concept from this build.

## 11. Resolved decisions

1. **Model versions:** Gemini 2.5 Flash was the original extraction plan, but as of September 23, 2026 it is inaccessible to new API keys even though its official shutdown date has not arrived. The provider returned a 404 directing new projects to Gemini 3 Flash Preview, so `gemini-3-flash-preview` was substituted as Google’s documented direct replacement. It supports multimodal image input and structured outputs. As of September 23, 2026, DeepSeek V4.1 Flash is the newest suitable text model; its current API identifier is `deepseek-flash`. The older `deepseek-v4-flash` name is a retired compatibility alias. DeepSeek is accessed via the OpenAI SDK pointed at `api.deepseek.com`.

2. **Background job mechanism:** An async function is triggered immediately after the upload endpoint responds. No separate queue library or external service (such as Redis or BullMQ) is used. This assessment targets a single-instance local/demo deployment, so a full queue system would add infrastructure this slice does not need. Known limitation: jobs in flight do not survive a server restart; this is documented in Section 7.

3. **Concurrency cap:** No more than 2 Gemini extraction calls may be in flight at once, enforced by an in-memory counter using the same pattern as the rate-limit utilities from prior assessments. A 3rd simultaneous upload waits in a simple queue rather than firing immediately.

4. **Rate limits:** The upload/extraction-trigger endpoint is limited to 5 requests per user per 10 minutes. The “Expand this itinerary” endpoint is limited to 10 requests per user per 10 minutes because it is cheaper and lower-risk than a full extraction. Both endpoints return `429` with a retry indication.

5. **Timeouts:** Each Gemini call has a 30-second timeout. Each DeepSeek call has a 20-second timeout. On timeout, the job is marked `FAILED` with `errorMessage` set to: `The AI service took too long to respond. Please try again.` There is no automatic retry on timeout.

6. **Retry policy for invalid structured output:** If the first response is successful but fails schema validation, the same input is retried once. If the retry also fails validation, the job is marked `FAILED` with the validation error recorded in `errorMessage`. There is no retry on a timeout or provider error (5xx); retries apply only to successful responses that fail schema validation.

7. **Cost model (current pricing as of September 2026):**
   - **Gemini 3 Flash Preview (`gemini-3-flash-preview`):** $0.50 per 1M input tokens and $3.00 per 1M output tokens, according to Google’s pricing documented for this model as of September 23, 2026. One extraction call (image plus prompt as input, approximately 1,500 tokens; structured JSON output, approximately 300 tokens) costs approximately $0.00165 per run. Gemini 2.5 Flash’s original pricing is no longer the applicable estimate because that model is inaccessible to the new API key used for this build.
   - **DeepSeek V4.1 Flash:** $0.15 per 1M input tokens and $0.60 per 1M output tokens at the off-peak rate. One expand call (approximately 800 input tokens and 500 output tokens) costs approximately $0.0004 per run.
   - A full flow (one extraction plus one expand) costs approximately $0.00205, just over two-tenths of a cent. Given Gemini’s free tier and DeepSeek’s 5-million-token free grant for new accounts, actual cost during this assessment’s development and testing is expected to be $0.
   - No hard spend cap is implemented for this assessment’s scope. The rate limits in point 4 are the practical ceiling on potential spend in a given window.
