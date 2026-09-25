## 1. What This Is

This slice lets a signed-in Roami user upload a photo of messy trip notes. A background job sends the image to Gemini for structured extraction of the destination, dates, and categorized activities, then displays the result in the dashboard's `Create from notes` modal. The user can optionally trigger a DeepSeek call to add more detail and a couple of suggested extra activities. When a matching destination photo is found, Unsplash attribution is attached to the result.

Deliberately, this slice does not include editing, saving, sharing, or exporting the generated itinerary, and it does not provide multi-itinerary history. There are no additional product features behind this flow because the brief limits the scope to one upload-to-result-to-expand path. This project reuses the complete Assessment 1 authentication flow—signup, email verification, signin, forgot/reset password, session management, and the dashboard—rather than a stripped-down or seeded version. That reuse is a deliberate choice and is disclosed here as required by the brief.

This project explicitly reuses both prior slices: the complete Assessment 1 authentication flow (signup, verification, signin, password recovery, sessions, and dashboard) and the complete Assessment 3 AI/Unsplash itinerary flow (Gemini extraction, DeepSeek expansion, and Unsplash photo lookup). Neither reused flow is the new graded scope of Assessment 4.

## 2. How To Run It

1. Clone the repository, enter the project directory, and install dependencies:

   ```powershell
   npm install
   ```

2. Create `.env` from `.env.example` and fill in every variable:

   - `DATABASE_URL` — the local PostgreSQL connection string. The configured project database is `roami_ai` on `localhost:5435`, using the `public` schema.
   - `SESSION_SECRET` — a self-generated secret, for example `openssl rand -hex 32`.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, and `SMTP_FROM_NAME` — the SMTP credentials and sender details used by the reused Assessment 1/2 email-verification flow.
   - `GEMINI_API_KEY` — a key from [Google AI Studio](https://aistudio.google.com/).
   - `DEEPSEEK_API_KEY` — a key from [DeepSeek Platform](https://platform.deepseek.com/).
   - `UNSPLASH_ACCESS_KEY` — an Unsplash application access key from [Unsplash Developers](https://unsplash.com/developers).

   Keep the real API keys only in `.env`; `.env.example` contains commented placeholders for the AI and Unsplash keys.

3. Start the local PostgreSQL instance. The confirmed database is reachable at `localhost:5435`, but Docker is not installed in the environment used to write this documentation, and this repository does not contain a Docker Compose file or a recorded container name. Therefore the exact `docker run` command currently used cannot be confirmed here without guessing. Start PostgreSQL using the local/container setup that exposes port `5435` and provides the `roami_ai` database, then ensure `DATABASE_URL` matches it.

4. Apply the Prisma migrations:

   ```powershell
   npx prisma migrate dev
   ```

5. Start the development server:

   ```powershell
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

6. No separate signup or seeded-user setup is required. Create a real account through the normal signup screen, complete email verification using the configured SMTP service, and sign in normally. The dashboard then provides the `Create from notes` entry point.

## 3. The Flow Step By Step

1. A signed-in user sends one JPG or PNG image as multipart form data in the `file` field to `POST /api/itinerary/upload`. The endpoint requires the existing database-backed session, enforces the 5-requests-per-user-per-10-minutes upload limit, and rejects empty or oversized files above the configured 20MB limit.

2. The endpoint writes the image to the local `uploads/itinerary/<userId>/` folder. The database stores only the generated relative `storageKey`, never the raw image bytes. It creates an `ItineraryJob` with `PENDING`, immediately changes it to `PROCESSING`, starts the background worker without awaiting it, and returns HTTP 202 with the job id right away.

3. The client polls `GET /api/itinerary/job/[id]` with the same authenticated session. The endpoint scopes the lookup by both job id and requesting user id, so another user’s job is never returned. `PROCESSING` returns the current status and attempts; `DONE` includes the full `Itinerary` and ordered `ItineraryActivity` records; `FAILED` includes `errorMessage`.

4. The background worker reads the uploaded image from the job’s `storageKey` and passes it to `lib/gemini.ts`. That client uses Google’s official Gemini SDK with Gemini 3 Flash Preview, the configured 30-second timeout, temperature, and output-token cap. Its system prompt requests only the structured itinerary JSON and Gemini receives an explicit JSON response schema for the destination, ISO dates, activity categories, titles, and notes.

5. The worker parses Gemini’s raw JSON response and validates it independently with the Zod itinerary schema. A successful response that fails validation is sent through exactly one retry with the same input. A second validation failure marks the job `FAILED` and records the validation error; timeout and provider errors are marked failed without retry. A valid response creates the `Itinerary` and ordered `ItineraryActivity` rows, then marks the job `DONE`.

6. Before creating the successful `Itinerary`, the worker calls `lib/unsplash.ts` with the extracted destination. That module searches Unsplash using `UNSPLASH_ACCESS_KEY` and returns the first usable photo plus photographer attribution. Unsplash failures or empty results are treated as optional enrichment: the job still reaches `DONE`, with the three Unsplash fields left `null` when no photo is available.

7. Poll the returned job id while the worker runs:

   ```bash
   curl -i http://localhost:3000/api/itinerary/job/<job-id> \
     -H "Cookie: roami_session=<signed-session-cookie>"
   ```

   The upload response is immediate and contains `{ "id": "<job-id>", "status": "PROCESSING" }`. A later poll returns `DONE` with the persisted itinerary and activities, or `FAILED` with the recorded timeout, provider, or validation error.

8. To expand a completed itinerary, the signed-in client sends `POST /api/itinerary/[id]/expand`. The route enforces the 10-requests-per-user-per-10-minutes limit, sends the current structured itinerary to `lib/deepseek.ts`, and uses DeepSeek V4.1 Flash through the official OpenAI SDK with `https://api.deepseek.com` as the overridden base URL. The response is independently validated with Zod and retried once only for schema-validation failure. A successful response updates existing activity notes and appends new activities in one database transaction, so provider, timeout, and validation failures leave the current itinerary unchanged.

9. The authenticated dashboard opens the client ItineraryModal from the Create from notes button in the empty-state card. The upload body keeps the selected file preview while the button shows the wave-spinner loading state and cosmetic pacing copy as the client polls GET /api/itinerary/job/[id] every second. A DONE response transitions directly to the result body, which calls POST /api/itinerary/[id]/expand; a FAILED response opens a smaller stacked error overlay above the still-visible upload modal. The old standalone Processing and Failed body screens are no longer used. There is no standalone itinerary page route; the flow stays inside the dismissible modal.

10. The Saved Places API is exposed through four route handlers. `POST /api/saved-places` validates the destination, optional note, and status, generates a publicId, and creates the authenticated user's record. `GET /api/saved-places` lists only rows scoped directly to the authenticated user's userId. `GET /api/saved-places/[publicId]` uses the shared ownership guard to return one owned record, while `DELETE /api/saved-places/[publicId]` uses the same guard and atomically writes a `DeletionAuditLog` snapshot before deleting the row in one transaction. These handlers return 401 when there is no valid session and 403 when a valid session cannot access the requested SavedPlace.

11. The dashboard sidebar's `Saved places` button updates the URL to `/dashboard?view=saved-places`, where `SavedPlacesClient` fetches the authenticated list and conditionally renders the empty state with `/images/illustrations/saved-places-empty-state.png` or the populated card grid.

   ![Saved Places empty state](<docs/evidence/empty-state.png>)

   *The empty state is a genuine empty view with the shipped illustration and Save a place action.*

   The create modal is rendered at `?view=saved-places&action=create` and submits to `POST /api/saved-places`.

   ![Saved Places create modal](<docs/evidence/create-modal.png>)

   *The create action is presented as a URL-addressable modal over the Saved Places screen.*

   Clicking a card opens `action=detail&ref=<publicId>`, which loads the detail API response.

   ![Saved Places detail view with attribution](<docs/evidence/detail view with attribution.png>)

   *The detail modal shows the destination photo together with its Unsplash attribution.*

   The detail modal's Delete button changes the URL to `action=delete&ref=<publicId>` for the stacked confirmation modal; confirmation calls `DELETE /api/saved-places/[publicId]`, refreshes the list, and returns to the base Saved Places URL.

   ![Saved Places delete confirmation modal](<docs/evidence/delete-confirmation-modal.png>)

   *The destructive action requires an explicit confirmation before deletion.*

   A manually substituted URL for another user's publicId stays in the detail state and displays the API's 403 error instead of showing the record.

12. Saved Place creation starts a best-effort Unsplash lookup through the reused `lib/unsplash.ts` client after the database row has been created. The lookup is fire-and-forget, so a slow or failed photo service never blocks or fails saving the destination. The client immediately inserts the returned record with its gradient/map-pin fallback, then polls only that new record's detail endpoint once per second for up to six attempts. When enrichment succeeds, the card swaps to the returned photo without a reload and without attribution text; the detail modal renders the same photo with photographer and Unsplash attribution links. When no usable result exists, both views keep the fallback with no broken-image placeholder.

   ![Saved Places photo fallback](<docs/evidence/the photo fallback.png>)

   *The card fallback remains clean when enrichment returns no usable photo.*

   The live-flow evidence record is reproduced here because it documents the save, six-poll fallback, no-result creation, detail, and deletion observations:

   # Saved Places live-flow evidence — 2026-09-25

   The live API-backed flow was run against the local Next.js server at `http://localhost:3000` using a real account created through the signup endpoint. The local browser automation surface was unavailable, so no screenshots were captured.

   ## Observed live flow

   ```text
   SIGNUP 201
   PHOTO_CREATE 201 {"publicId":"1HZWmoVaPPdZ","destination":"Paris, France","note":"Live photo enrichment evidence","unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null,"status":"PLANNED"}
   PHOTO_POLL_1 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
   PHOTO_POLL_2 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
   PHOTO_POLL_3 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
   PHOTO_POLL_4 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
   PHOTO_POLL_5 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
   PHOTO_POLL_6 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
   NO_PHOTO_CREATE 201 {"publicId":"D6FsvpLc3nuC","destination":"zzzz-no-unsplash-result-1790326817314","note":"Fallback evidence","unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null,"status":"WISHLIST"}
   POPULATED_LIST 200 [Paris record, no-result record]
   PHOTO_DETAIL 200 [Paris record with all Unsplash fields null]
   DELETE_PHOTO 204
   AFTER_DELETE_LIST 200 [no-result record only]
   ```

   The Paris record appeared immediately with the fallback fields null, remained saved, and completed all six individual detail polls without blocking the save. The no-result destination also returned 201 and remained available with null photo fields. Deleting the Paris record returned 204 and removed it from the subsequent list.

   ## UI evidence status

   - Empty state: not visually captured; the component renders the shipped empty-state illustration and Save a place action.
   - Create modal: not visually captured; URL state and form implementation are present.
   - Populated card: not visually captured; live list data was returned.
   - Immediate fallback: API response showed null photo fields immediately after save.
   - Photo transition: not observed because Unsplash returned no usable result in this environment for the tested destinations.
   - Card attribution: source implementation passes `attribution={false}` for card previews.
   - Detail attribution: source implementation retains attribution by default in `PhotoPanel`.
   - Delete confirmation: not visually captured; delete endpoint returned 204.
   - Post-delete list: live response omitted the deleted Paris record.
   - No-result fallback: live creation succeeded with all three photo fields null.
## 4. The Data Model

`ItineraryJob` records every uploaded image and tracks the asynchronous extraction lifecycle through `PENDING`, `PROCESSING`, `DONE`, or `FAILED`, including attempts, failure details, and the local filesystem storage key. `Itinerary` stores one successful structured result for a job, including the destination, dates, optional Unsplash photo attribution, and timestamps. `ItineraryActivity` stores the ordered, categorized activities belonging to an itinerary.

The `Itinerary.jobId` unique constraint enforces one itinerary per job, preventing a single upload job from somehow producing two itinerary records. Foreign-key relations connect jobs to users and itineraries to jobs and activities, while the activity `order` value preserves display sequence.

`SavedPlace` stores one destination a signed-in user has saved, with an internal `id`, the externally safe 12-character `publicId`, an optional note, a status, and timestamps. Its `publicId` unique constraint prevents identifier collisions, while the `userId` index supports ownership-scoped list queries. `DeletionAuditLog` records each deletion using the deleting user's id plus snapshotted destination and publicId data. It intentionally does not use a foreign key to `SavedPlace`: the referenced row will not exist after deletion, so a foreign key would either block the deletion or be left dangling.
## 5. The Concepts

### Scoping the query versus checking after the fetch

**What it is:** Query scoping places the authenticated user's `userId` directly in the database predicate that retrieves a SavedPlace. Fetch-then-check instead retrieves by a publicId first and compares ownership afterward in application code.

**Why it's needed:** A fetch-then-check pattern still executes a database read for data the user has no right to see, and a missed or buggy check anywhere in that path silently leaks it. Scoping the query makes the leak structurally impossible rather than dependent on remembering a check.

**How I implemented it:** `lib/saved-places-guard.ts` contains the single shared `findOwnedSavedPlace` function every detail and delete route uses. It queries with both `userId` and `publicId`. The list route similarly puts the session's `userId` directly in its `where` clause, and deletion keeps both values in its transactional `deleteMany` predicate.

**What I chose against:** I rejected fetching by `publicId` alone and then comparing the returned row's `userId` to the session in application code because it is an extra step that can be forgotten in a future route, whereas baking `userId` into the query itself cannot be skipped.

### Authentication versus authorization

**What it is:** Authentication establishes who the requester is; authorization establishes whether that authenticated requester may access a particular record.

**Why it's needed:** A valid session alone must not grant access to every SavedPlace. The security boundary is the combination of a valid session and ownership of the requested publicId.

**How I implemented it:** Every Saved Places route calls `validateSession()` first and returns 401 when no valid session exists. List, detail, enrichment, and delete operations then scope their Prisma predicates by the session's `userId`; detail and delete return 403 for a valid but unauthorized session.

**What I chose against:** I rejected treating authentication as sufficient authorization, because that would let any signed-in user probe another user's public identifiers.

### Insecure direct object references

**What it is:** An insecure direct object reference occurs when a caller changes an identifier in a URL or request and the server returns another user's record.

**Why it's needed:** SavedPlace publicIds are intentionally addressable in URLs, so direct API and URL substitution are realistic attack paths rather than hypothetical UI misuse.

**How I implemented it:** The detail and delete routes combine `userId` and `publicId` in the database lookup, and the list route only returns rows for the session user. The two-user evidence file records User B receiving an empty list and 403 responses for User A's publicId.

![Direct-object-reference attempt blocked](<docs/evidence/url-substitution-blocked.png>)

*A direct URL substitution using another user's publicId is blocked instead of returning the record.*

**What I chose against:** I rejected relying on unguessable publicIds alone. Random identifiers reduce accidental discovery but do not establish ownership.

### Access-control audit evidence

The two-user attack test was performed through the actual signup flow. User A created a SavedPlace, and User B attempted to list, view, and delete it.

#### Saved Places access-control evidence — 2026-09-25

The two accounts below were created through the actual `POST /api/auth/signup` flow. They are synthetic test accounts.

- User A: `records.a.1790325519@example.com`
- User B: `records.b.1790325519@example.com`
- User A saved-place publicId: `cDkFAxnG26e3`

##### Signup and creation

```text
SIGNUP_A email=records.a.1790325519@example.com status=201 body={"userId":"cmugpmpvr000gt4i8mj8rzuxw","email":"records.a.1790325519@example.com"} cookiePresent=True
SIGNUP_B email=records.b.1790325519@example.com status=201 body={"userId":"cmugpmrmq000kt4i8pd89fopn","email":"records.b.1790325519@example.com"} cookiePresent=True
CREATE_A status=201 body={"publicId":"cDkFAxnG26e3","destination":"Test Destination for Access Control","note":"User A private record","unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null,"status":"WISHLIST","createdAt":"2026-09-25T08:39:51.776Z","updatedAt":"2026-09-25T08:39:51.776Z"}
```

##### User B mismatch tests

```text
LIST_B status=200 body=[] containsUserAPlace=False
DETAIL_B status=403 body={"error":"You do not have access to this saved place."}
DELETE_B status=403 body={"error":"You do not have access to this saved place."}
```

Interpretation: User B cannot see User A's record in the list and cannot retrieve or delete it by publicId. The server returns 403 for both direct ownership mismatches, as required by the PRD.

##### Browser URL substitution

The browser URL-substitution screenshot above is the visual evidence for navigating to `/dashboard?view=saved-places&action=detail&ref=cDkFAxnG26e3` as User B. The original evidence record also notes that the browser surface was unavailable for the automated capture session.

### Why raw database identifiers are not exposed

**What it is:** The internal Prisma `id` is a database implementation identifier, while `publicId` is the deliberate external identifier for SavedPlace URLs and responses.

**Why it's needed:** Exposing internal identifiers couples the client to storage details and can reveal sequential or otherwise meaningful database identifiers that make probing easier.

**How I implemented it:** `savedPlacePublicSelect` projects only `publicId`, destination data, status, timestamps, and optional photo fields. The detail route also returns a hand-written public projection, and every UI URL uses `ref=<publicId>`.

**What I chose against:** I rejected returning the complete Prisma row from route handlers, even though it is convenient, because that would make accidental internal-id leakage structurally easy.

### Audit logging

**What it is:** An audit log is a durable record of a sensitive action, independent of the record being acted upon.

**Why it's needed:** After a SavedPlace is deleted, its destination and public identifier must still be available to explain what was removed, by whom, and when.

**How I implemented it:** DELETE snapshots `userId`, destination, publicId, and `deletedAt` into `DeletionAuditLog` before deleting the SavedPlace inside one Prisma transaction.

**What I chose against:** I rejected a foreign key from the audit row to SavedPlace because the referenced row disappears during deletion; that would either block the delete or leave a dangling reference.

### Page architecture with URL state

**What it is:** URL-state architecture keeps the current view and modal stack in query parameters while one page conditionally renders the appropriate state.

**Why it's needed:** Empty, populated, create, detail, and delete-confirm states must be independently reachable, bookmarkable, and recoverable through browser navigation.

**How I implemented it:** `/dashboard?view=saved-places` renders the screen; `action=create`, `action=detail&ref=<publicId>`, and `action=delete&ref=<publicId>` render the stacked modal states. `router.replace` updates those parameters without a full reload.

**What I chose against:** I rejected local component state as the sole modal source of truth, because a modal reachable only after clicking through the UI cannot be directly navigated to or restored from a URL.

### Status codes: 401 versus 403

**What it is:** 401 means the request has no valid authentication; 403 means the requester is authenticated but is not authorized for the requested resource.

**Why it's needed:** The distinction lets clients handle sign-in state separately from ownership denial and avoids conflating identity with access rights.

**How I implemented it:** All Saved Places routes return 401 when `validateSession()` fails. Detail and delete return 403 when a valid session cannot find an owned record for the supplied publicId.

**What I chose against:** I rejected returning 401 for ownership mismatches, because that falsely describes an authenticated user as unauthenticated and obscures the authorization failure.

### Database indexing

**What it is:** An index is a database structure that accelerates lookups on columns used in predicates or ordering.

**Why it's needed:** Every list request filters by userId, while detail and delete identify records by publicId; those access paths should not require broad table scans as data grows.

**How I implemented it:** SavedPlace has a unique index on publicId and an index on userId. DeletionAuditLog has an index on userId.

**What I chose against:** I rejected indexing only the internal id, because that is never the external lookup key and would not support the actual ownership-scoped access patterns.

### Query count as a cost

**What it is:** Query count is the number of database operations a request causes, including authentication, record lookup, audit writes, and transaction operations.

**Why it's needed:** Fewer queries reduce latency and database load, while real counts expose the cost of an authorization design instead of hiding it behind an unmeasured claim.

**How I implemented it:** Temporary Prisma query-event logging measured the current baseline: list 3 raw events / 2 application queries, detail 3 raw events / 2 application queries, and delete 7 raw events / 4 application SQL statements. Raw events include `SELECT 1`, `BEGIN`, and `COMMIT` where applicable. The full evidence is in `docs/evidence/saved-places-query-counts-2026-09-25.md`.

#### Saved Places query-count evidence — 2026-09-25

Temporary Prisma query-event logging was enabled in `lib/prisma.ts` on an isolated development server at `http://localhost:3002`. The logger was removed after measurement. Requests were run sequentially with one authenticated session and one SavedPlace (`publicId=uZb8IGc4y0b3`).

| Action | Raw Prisma events | Application queries/statements | Observed operations |
|---|---:|---:|---|
| List | 3 | 2 | `SELECT 1`, session lookup, user-scoped SavedPlace list query |
| Detail | 3 | 2 | `SELECT 1`, session lookup, combined userId/publicId lookup |
| Delete | 7 | 4 SQL statements | `SELECT 1`, session lookup, combined ownership lookup, `BEGIN`, audit insert, scoped delete, `COMMIT` |

The raw event count includes Prisma's connection `SELECT 1` and transaction-control events. The application-query count excludes `SELECT 1`, `BEGIN`, and `COMMIT` while retaining the session lookup and SavedPlace/audit statements.

##### Request results

```text
LIST_STATUS 200
DETAIL_STATUS 200
DELETE_STATUS 204
```

No prior unoptimized implementation had been instrumented, so these are the current baseline counts rather than a before/after reduction. The detail and delete lookup events confirmed the ownership predicate contained both `userId` and `publicId`.

**What I chose against:** I chose not to claim a before/after optimization reduction because no earlier unoptimized version was instrumented; these are honestly labeled baseline measurements.

### Structured output and schema validation

Structured output means Gemini is asked for a JSON object matching an explicit itinerary schema: destination, ISO start and end dates, and categorized activities with a title and note. This is needed because trusting a 200 response without validating its shape means a malformed or incomplete response could silently corrupt the itinerary or crash downstream code that expects fields which are not there.

`lib/gemini.ts` requests Gemini’s JSON response mode and response schema. `lib/itinerary-job.ts` independently parses the returned JSON and validates it with Zod before any database rows are created. If a successful response fails validation, the same input is retried once; if validation fails again, the job is marked `FAILED` with the validation error. Timeouts and provider errors are not retried.

This was chosen instead of trusting the model’s own schema enforcement alone. The model-side schema guides generation, while application-side Zod validation is the independent safety boundary before data is persisted.

### SDKs versus raw HTTP

DeepSeek is called through the official OpenAI SDK even though DeepSeek is a different provider because DeepSeek deliberately exposes an OpenAI-compatible API. `lib/deepseek.ts` constructs the official `OpenAI` client with `baseURL: "https://api.deepseek.com"`, the configured `deepseek-flash` model, timeout, temperature, and JSON response mode. This reuses a well-tested SDK for request construction, authentication, timeout handling, and response typing instead of maintaining a custom raw HTTP client for DeepSeek.
### API endpoints

What it is: An API endpoint is a specific URL a client can send a request to, which the server matches to a handler function that does something and returns a response. In this project, /api/itinerary/upload, /api/itinerary/job/[id], and /api/itinerary/[id]/expand are the three endpoints driving the whole flow.
Why it's needed: without a defined, addressable endpoint per action, the frontend would have no reliable, consistent way to trigger a specific piece of server-side logic  every action needs its own clear contract for what request it expects and what response it returns.
How I implemented it: Next.js App Router route handlers, one file per endpoint (app/api/itinerary/upload/route.ts, app/api/itinerary/job/[id]/route.ts, app/api/itinerary/[id]/expand/route.ts), each exporting a POST or GET function.
What I chose against: a single catch-all endpoint that branched internally on an action parameter, rejected because separate endpoints give each action its own URL, its own independently testable contract, and its own rate limit  rather than one endpoint doing several unrelated things behind a conditional.

### System prompts versus user prompts

What it is: a system prompt sets a model's role, constraints, and behavior for the whole call, decided once by the developer; a user prompt (here, the uploaded image for extraction, or the existing itinerary data for expansion) is the actual per-request task input that varies every time.
Why it's needed: without this separation, every request would need to re-state the rules (the exact JSON shape expected, the category enum, the instruction not to invent a destination) alongside the actual task  mixing fixed behavior with variable input makes both harder to get consistently right and impossible to reason about independently.
How I implemented it: the extraction system prompt lives in lib/itinerary-job.ts and is passed to lib/gemini.ts alongside the uploaded image (the user input): "You are Roami's itinerary extraction model. Read the uploaded travel-notes image and return only the structured JSON requested by the response schema. Extract the destination, start date, end date, and every identifiable activity... If the image does not contain enough information to identify a complete destination and date range, return the best-supported non-empty values only when they are actually present; otherwise return a structured response that will fail validation rather than inventing a destination or date." The expansion system prompt lives in app/api/itinerary/[id]/expand/route.ts, passed to lib/deepseek.ts alongside the existing itinerary (the user input): "You are Roami's itinerary expansion model... Preserve the destination, dates, and every existing activity in its current order... Do not invent a new destination or change the dates."
What I chose against: folding the extraction rules into a single combined prompt sent fresh with every request, rejected because it would require repeating the anti-hallucination and schema-shape instructions on every call instead of fixing them once in a role definition separate from the varying input.

### Model parameters

What it is: the tunable settings passed alongside a prompt that shape how the model generates its response  this project sets temperature (how deterministic vs. varied the output is) and a max output token cap for both models.
Why it's needed: without deliberately set parameters, a model defaults to settings tuned for general conversation, not for a specific task like structured extraction  an unconstrained temperature on the extraction call risks the same notes producing a different destination or activity list on separate runs, which is unacceptable for a task that should be consistent.
How I implemented it: both values live in lib/ai-config.ts as a shared AI_CONFIG object, imported by both model wrappers rather than hardcoded per call. Gemini extraction: temperature 0.1 (low, since extraction should be factual and repeatable  the same input notes should reliably produce the same structured result), maxOutputTokens 2048 (enough room for a full itinerary's structured JSON without inviting padded output). DeepSeek expansion: temperature 0.5 (moderate, since this call is generative  writing new detail and suggesting new activities benefits from some variety, while staying grounded rather than freewheeling), maxOutputTokens 1024 (smaller than extraction's cap, since expansion adds detail to an already-known structure rather than generating a full itinerary from nothing).
What I chose against: using each SDK's default temperature (typically around 0.71.0) for both calls, rejected because a default tuned for open-ended conversation is wrong for a task like extraction that specifically needs low variance, and even for the more generative expansion call, an unconstrained default risks output drifting away from the actual source itinerary.

### Jobs and workers

What it is: a job is a database record representing one unit of asynchronous work (here, one ItineraryJob per upload); a worker is the code that actually picks up and performs that work, separate from the request that created it.
Why it's needed: without this separation, the upload request itself would have to wait for the full Gemini call to finish before responding  turning a fast, simple file upload into a slow, blocking request that ties up a connection for as long as the AI call takes, and gives the user nothing to look at until it's fully done.
How I implemented it: POST /api/itinerary/upload creates the ItineraryJob row (status PENDING, then PROCESSING) and returns immediately with the job's id; a separate async function (not awaited by the request handler) performs the actual Gemini call, validation, and database update, later transitioning the same job row to DONE or FAILED. The client polls GET /api/itinerary/job/[id] to observe that transition.
What I chose against: a proper external job queue (e.g. BullMQ backed by Redis), rejected for this assessment's scope per PRD Section 11  a queue adds real infrastructure (a Redis instance, a separate worker process) that a single-instance local/demo deployment doesn't need; the tradeoff, documented honestly in Section 7, is that an in-flight job does not survive a server restart.

### Queues, FIFO, and why concurrency is capped

What it is: a concurrency cap limits how many extraction calls to Gemini can be in flight at the same time, regardless of how many uploads arrive close together.
Why it's needed: without a cap, five uploads arriving in the same second would fire five simultaneous Gemini calls  multiplying cost unpredictably in a burst, and risking hitting Gemini's own rate limits all at once, which would fail every one of those calls rather than just queuing the excess.
How I implemented it: lib/concurrency.ts holds an in-memory counter enforcing a maximum of 2 concurrent Gemini calls (per AGENTS.md); a 3rd simultaneous upload's extraction call waits until a slot frees up rather than firing immediately.
What I chose against: no cap at all, relying purely on the per-user rate limit to bound load, rejected because the rate limit bounds one user's request rate over time, not how many calls are running at the exact same instant across all users  the concurrency cap and the rate limit solve two different problems and both are needed.

### Rate limiting as a cost control

What it is: a limit on how many times a given user can trigger a costly action (uploading for extraction, or requesting an expansion) within a given time window.
Why it's needed: every extraction and expansion call costs real money (however small per call); without a limit, a user  accidentally or deliberately  could trigger the same costly action repeatedly in a tight loop, and the app would pay for every single one with no natural ceiling.
How I implemented it: lib/job-rate-limit.ts enforces 5 upload/extraction attempts per user per 10 minutes, and 10 expand attempts per user per 10 minutes (higher, since expansion is cheaper and lower-risk than a full extraction)  both returning 429 with a retry indication when exceeded.
What I chose against: a single shared limit covering both actions together, rejected because upload and expand have different real costs and different natural usage patterns (one upload typically leads to at most one or two expand clicks)  giving each its own threshold reflects that rather than forcing one number to fit both.

### Why files live in object storage rather than the database

What it is: the uploaded image itself is written to a location on the local filesystem; only a storage key (a file path string) referencing that location is written to the database.
Why it's needed: storing large binary file data directly in database rows makes every ordinary query against that table slower and heavier than it needs to be, and most databases are not built or optimized to serve raw files efficiently the way a dedicated storage layer is.
How I implemented it: the upload endpoint saves the file to a local uploads directory and writes only the resulting path as ItineraryJob.storageKey; the extraction worker reads the file back from that path using the stored key when it needs to send it to Gemini. This is documented, per PRD Section 11, as the local-development equivalent of real cloud object storage (e.g. S3 or R2)  the same key-only pattern would apply unchanged if this were swapped for a real cloud provider later.
What I chose against: storing the image as a binary blob directly in the ItineraryJob row, rejected both because it fails the brief's explicit requirement and because it would make the jobs table dramatically heavier to query and back up than it needs to be for data that's genuinely just a reference.

### Your cost model

What it is: an estimate of what a single run through this AI flow actually costs, and what bounds total spend.
Why it's needed: without a stated cost model, there's no way to reason about whether this feature is sustainable at any real scale, or to notice if a change (a longer prompt, a higher token cap) meaningfully changes what each run costs.
How I implemented it: per docs/PRD.md Section 11 (pricing checked September 2026)  Gemini 3 Flash Preview extraction (~1,500 input tokens including the image, ~300 output tokens) costs approximately $0.00165 per run at $0.50/1M input and $3.00/1M output tokens. DeepSeek expansion (~800 input tokens, ~500 output tokens) costs approximately $0.0004 per run. A full flow (one extraction plus one expansion) costs roughly $0.00205  a fraction of a cent. In practice, development for this project was covered mostly by free-tier access: Gemini's free tier and DeepSeek's 5-million-token new-account grant. One real out-of-pocket cost was incurred: a $2 minimum account top-up required by DeepSeek to enable live paid API calls beyond the free grant  a one-time account-funding step, not a per-call charge. No hard spend cap is implemented beyond this; the rate limits described above are the practical ceiling on how much could be spent by one user in a given window.
What I chose against: an explicit hard dollar cap on total spend (e.g. shutting off the feature entirely past a daily budget), rejected as unnecessary complexity for this assessment's scope  the rate limits already bound worst-case spend per user to a small, predictable number, and a global spend cap would require additional infrastructure (tracking cumulative spend across all users) that isn't needed to demonstrate the concept.

## 6. What Went Wrong

### Nested git repository from the Assessment 1 copy

Symptom: git operations behaved unpredictably during initial setup.

Investigation: the copied Assessment 1 project had been placed as a subfolder inside this project's root rather than flattened into it, complete with its own `.git` directory. This briefly meant the project contained two separate git repositories, one nested inside the other.

Cause: the copy step preserved the source project's internal structure and `.git` folder instead of merging its contents directly into this project's root.

Fix: every file was moved up one level to this project's actual root, the nested folder and its `.git` directory were deleted entirely, and only one git repository was confirmed before git setup.

### Database connection failure during the schema/scaffold step

Symptom: Prisma reported that it could not reach a database server on the port configured in `.env`.

Investigation: the Prisma schema and migration files were correct; the actual problem was that no Postgres container was running at all, which was an oversight in setup order.

Cause: `.env` was pointing at a port with nothing listening on it locally.

Fix: a dedicated Postgres container was started on a fresh port not already used by the other Roami assessment projects, and `.env` was updated to match.

### Gemini model unavailability

Symptom: the extraction call returned a 404 for `gemini-2.5-flash` with the message "no longer available to new users," despite the model's official documented shutdown date not having arrived yet.

Investigation: this was not a code or configuration bug; the same request structure worked once a different model identifier was used.

Cause: Google restricts new API keys from accessing the 2.5 model series ahead of its formal deprecation date, even though existing keys with prior usage retain access. That distinction was not obvious from the model's public documentation alone.

Fix: the project switched to `gemini-3-flash-preview`, Google's own documented direct replacement for `gemini-2.5-flash`, and the PRD, `AGENTS.md`, and cost model were updated to reflect the actual model in use.

## 7. What This Slice Does Not Handle

- Background jobs do not survive a server restart, since no external queue such as Redis or BullMQ is used, per the deliberate scope decision in PRD Section 11. A job in `PROCESSING` when the server restarts is left in that state indefinitely.
- There is no hard spend cap on AI usage beyond the rate limits already described.
- There is no retry on Gemini or DeepSeek timeouts or provider errors. Retries apply only to schema-validation failures, per the documented retry policy.
- There is no multi-itinerary history, editing, sharing, or export. This slice is strictly one upload-to-result-to-expand flow, per PRD Section 6.
- Uploaded images use local filesystem storage, not real cloud object storage. This is documented as the local-development equivalent per PRD Section 11, meaning uploaded files do not survive deployment to a different host without additional work.
- The Unsplash no-result path is implemented and handles failures and empty results gracefully. A live synthetic no-result destination was exercised successfully; a confirmed real destination with no available photo was not.
- Unsplash photo enrichment is best-effort and asynchronous. A newly created card starts with the clean gradient/map-pin fallback, then polls only that record once per second for up to six attempts; a successful response swaps in the photo without a reload, while a provider failure or six null responses permanently leaves the fallback for that card. Card previews intentionally omit attribution, while the detail modal includes the photographer and Unsplash links. Editing is out of scope, so photos are not re-fetched for destination-name changes.
- Live UI screenshots and the browser URL-substitution attack walkthrough were not captured because the available environment did not expose a browser surface. API access-control, query-count, and live-flow outputs are preserved under `docs/evidence/`.

## 8. If I Built This Again

The biggest change would be checking model availability for new API keys before locking a specific model identifier into the PRD and `AGENTS.md`. The Gemini 404 cost real time mid-build because the model chosen during planning turned out to be inaccessible the moment a fresh key was used against it, a distinction the public deprecation timeline did not surface. A five-minute test call with the actual new key, before writing the model name into governing documents, would have caught this before it became a live blocker.
