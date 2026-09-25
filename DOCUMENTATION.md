## 1. What This Is

This slice lets a signed-in Roami user upload a photo of messy trip notes. A background job sends the image to Gemini for structured extraction of the destination, dates, and categorized activities, then displays the result in the dashboard's `Create from notes` modal. The user can optionally trigger a DeepSeek call to add more detail and a couple of suggested extra activities. When a matching destination photo is found, Unsplash attribution is attached to the result.

Deliberately, this slice does not include editing, saving, sharing, or exporting the generated itinerary, and it does not provide multi-itinerary history. There are no additional product features behind this flow because the brief limits the scope to one upload-to-result-to-expand path. This project reuses the complete Assessment 1 authentication flow—signup, email verification, signin, forgot/reset password, session management, and the dashboard—rather than a stripped-down or seeded version. That reuse is a deliberate choice and is disclosed here as required by the brief.

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
## 4. The Data Model

`ItineraryJob` records every uploaded image and tracks the asynchronous extraction lifecycle through `PENDING`, `PROCESSING`, `DONE`, or `FAILED`, including attempts, failure details, and the local filesystem storage key. `Itinerary` stores one successful structured result for a job, including the destination, dates, optional Unsplash photo attribution, and timestamps. `ItineraryActivity` stores the ordered, categorized activities belonging to an itinerary.

The `Itinerary.jobId` unique constraint enforces one itinerary per job, preventing a single upload job from somehow producing two itinerary records. Foreign-key relations connect jobs to users and itineraries to jobs and activities, while the activity `order` value preserves display sequence.

`SavedPlace` stores one destination a signed-in user has saved, with an internal `id`, the externally safe 12-character `publicId`, an optional note, a status, and timestamps. Its `publicId` unique constraint prevents identifier collisions, while the `userId` index supports ownership-scoped list queries. `DeletionAuditLog` records each deletion using the deleting user's id plus snapshotted destination and publicId data. It intentionally does not use a foreign key to `SavedPlace`: the referenced row will not exist after deletion, so a foreign key would either block the deletion or be left dangling.
## 5. The Concepts

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
- The Unsplash no-result path is implemented and handles failures and empty results gracefully, but it was not exercised against a confirmed real destination with no available photos during testing.

## 8. If I Built This Again

The biggest change would be checking model availability for new API keys before locking a specific model identifier into the PRD and `AGENTS.md`. The Gemini 404 cost real time mid-build because the model chosen during planning turned out to be inaccessible the moment a fresh key was used against it, a distinction the public deprecation timeline did not surface. A five-minute test call with the actual new key, before writing the model name into governing documents, would have caught this before it became a live blocker.
