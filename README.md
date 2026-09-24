# AI Interview Prep Kit

Turns a pasted job description + a company URL into a structured interview prep kit: a company brief,
a role breakdown with stable requirement ids, a categorised question bank, flashcards, and a day-by-day
study schedule — built through a sequence of deliberate retrieval + generation steps, not one prompt.

## Tech stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend:** Node.js + Express, TypeScript throughout
- **Database:** MongoDB (Mongoose)
- **Scraping:** hand-rolled fetcher/crawler (`undici`/native `fetch`, no headless browser — these are
  static marketing/careers pages, not SPAs, so a browser wasn't worth the memory/time cost)
- **LLM:** OpenAI-compatible chat-completions API, defaulting to **DeepSeek** (`deepseek-chat`), because
  it has a genuine free tier and speaks the same JSON-mode/tool-call-free wire format as most providers —
  swapping `LLM_BASE_URL`/`LLM_MODEL` to any OpenAI-compatible endpoint (Groq, Together, OpenAI itself)
  works without code changes.
- Monorepo managed with npm workspaces (`apps/api`, `apps/web`, `packages/shared` for the `Kit`/batch types
  shared by both).

## Setup

### Local

```sh
npm install
cp .env.example apps/api/.env   # or root .env — config.ts reads from process.env either way
# edit apps/api/.env: set MONGODB_URI, LLM_API_KEY at minimum
npm run dev                     # runs api (4000) + web (3001) concurrently
```

Requires a MongoDB instance (local `mongod` or a free Atlas cluster) and an API key for whichever
OpenAI-compatible LLM endpoint you point `LLM_BASE_URL` at.

### Batch entry point (Section 9)

```sh
npm run evaluate -- --input examples/cases.json --output kits.json
```

Runs from a clean clone with only `npm install` + a populated `.env` — no separate setup. It imports
`runPipeline()` directly from `apps/api/src/pipeline/runPipeline.ts`, the exact function the HTTP route
calls, so batch and interactive kits are produced by identical code. Per-case failures are caught and
recorded (`status: "failed"`) without aborting the run; the fetcher/crawler follow relative links and
don't assume a particular host, so `company_url` can point at `http://localhost:PORT/...` fixtures.

### Deployed

Frontend and API are deployed as two separate services (see `NEXT_PUBLIC_API_URL` / `CLIENT_ORIGIN` in
`.env.example` for how they're wired together). Environment variables are the same as local; secrets
(`LLM_API_KEY`, `SESSION_SECRET`, `MONGODB_URI`) are set on the hosting platform, never committed.

## Environment variables

See `.env.example` for the full, commented list. Summary:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string |
| `SESSION_SECRET` | Express session signing secret |
| `CLIENT_ORIGIN` | Allowed CORS origin(s) for the frontend |
| `PORT` | API port |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | OpenAI-compatible LLM endpoint |
| `LLM_MAX_RETRIES` | Retry ceiling for rate-limit/transient LLM failures |
| `MAX_COVERAGE_PASSES` | Cap on second-pass coverage loops |
| `CRAWL_MAX_PAGES` | Pages fetched per company crawl |
| `ALLOW_PRIVATE_URLS` | Allows localhost/private IPs (dev + batch fixtures only — **must be `false` in production**) |
| `NEXT_PUBLIC_API_URL` | API base URL the frontend calls |

## High-level architecture

```
apps/api/src/
  services/    fetcher.ts (HTTP + robots + SSRF guard), crawler.ts (link ranking),
               search.ts (public discussion lookup), llm.ts (retrying LLM client)
  pipeline/    extractRequirements, researchCompany, companyBrief, generateQuestions,
               generateFlashcards, coverage (deterministic), scheduler (deterministic),
               validateKit (deterministic), runPipeline (orchestrator)
  routes/      auth.ts, kits.ts (CRUD + builder mutations + regenerate + practice)
  models/      Mongoose schemas (User, Kit)
  scripts/     evaluate.ts — the batch entry point
apps/web/
  app/         dashboard, login/register, /kits/[id] (tabs: brief/role/questions/flashcards/schedule/practice)
  components/  one component per tab + shared AppHeader/TabNav/ProgressView
```

Retrieval, extraction, generation, scheduling, and persistence are separate modules with no cross-imports
except through `runPipeline`, which is the only place that sequences them.

## Retrieval approach & sources

- **Job description:** pasted text only — never fetched from a job board.
- **Company site:** `crawler.ts` fetches the homepage, extracts every same-origin link, and scores each
  by keyword signal in the URL + anchor text (`careers`, `jobs`, `handbook`, `how we hire`, etc. for hiring;
  `about`, `mission`, `engineering blog`, etc. for company context). No fixed path list — this is
  deliberate, since the brief calls out that hiring pages live at unpredictable paths. The top-scoring
  hiring page(s) then top-scoring about pages are fetched up to `CRAWL_MAX_PAGES`, with a small delay
  between requests and per-request timeouts.
- **Public interview discussion:** `search.ts` queries for public discussion of the company's interview
  process (best-effort; a provider that returns nothing produces an honest "no discussion found" state,
  not a fabricated one).
- Every fetch goes through `fetcher.ts`: robots.txt is checked before any non-robots request, content-type
  is restricted to `text/html`/`text/plain`, response size is capped and streamed with a hard limit, and
  `assertPublicUrl()` rejects loopback/private/link-local addresses via both literal-IP and DNS-resolution
  checks whenever `ALLOW_PRIVATE_URLS` is false (production). A source that can't be retrieved is recorded
  in `failures[]` and skipped — it never aborts the run.

## Sequencing — what each step does

`runPipeline.ts` runs ten explicit steps, each reported to the frontend as it happens (`PipelineStep[]`,
polled by `/kits/:id/progress`):

1. **Extract** — pull requirements/responsibilities/seniority from the pasted JD (no retrieval needed).
2. **Crawl** the company site.
3. **Locate hiring page(s)** among the crawl results.
4. **Search public discussion** of the interview process.
5. **Company brief** — generated from whatever was actually found; empty/thin retrieval produces an
   honest brief, not an invented one.
6. **Questions, one LLM call per category** — technical requirements (plus domain requirements, which are
   a requirement *kind*, not a question category) get technical questions; behavioural requirements get
   behavioural questions; a hiring page or senior+ role adds system-design; any brief/hiring signal adds
   company-fit. Different requirement kinds are deliberately never asked in the same call with the same
   instructions, because "5 years of React" and "mentors junior engineers" need different framing.
7. **Deterministic coverage check + bounded second pass** — `coverage.ts` (plain set arithmetic, no LLM)
   finds must-have requirements with zero questions against them; while gaps remain and the pass count is
   under `MAX_COVERAGE_PASSES` (default 3: first draft + up to 2 gap-filling passes), a follow-up
   generation call targets exactly the uncovered requirements. Three passes was chosen because in practice
   a single follow-up closes nearly every gap, and further passes mostly retry against genuinely
   unanswerable content (e.g. a two-line JD) — better to stop and report the honest remainder in
   `coverage.uncovered_requirement_ids` than to loop indefinitely against a rate-limited provider.
8. **Flashcards** generated from the (by now gap-filled) question set.
9. **Deterministic schedule allocation** — arithmetic, not a prompt (see below).
10. **Structure validation** against Appendix A before the kit is ever persisted.

## Generated / edited / pinned state

Every question and flashcard carries `origin` (`"generated" | "manual"`), `pinned` (boolean), and `edited`
(boolean). A regeneration of one section (`regenerate(section, category?)`) only replaces items where
`origin === "generated" && !pinned && !edited` *within that section/category* — anything the user wrote
by hand, pinned, or has edited is left untouched and re-merged into the result. This is what lets
"regenerate the technical category" coexist with "I hand-edited q3" without a special-case diff: the
predicate is checked per-item at regeneration time rather than trying to reconcile two full kit snapshots.

## Schedule allocation

Deterministic, in `scheduler.ts` — never handed to the LLM. Questions are weighted (must-have requirement
coverage dominates, then higher difficulty) and distributed across exactly `days_available` days at a
target of ~90 minutes/day in integer `MINUTES_PER_QUESTION` (15 min) increments, front-loading harder/
higher-priority material. The final day of a multi-day plan is reserved for review rather than new
material. A 1-day schedule collapses everything into that single day; a 60-day schedule spreads the same
question count thin rather than inventing filler, so late days can legitimately be empty ("rest / review
— nothing scheduled").

## Coverage checking

Also deterministic (`coverage.ts`): a requirement is "covered" iff at least one question's
`requirement_ids` includes it. Only `must` requirements gate a kit; `nice` gaps are never reported. This
and the scheduler are both unit-tested (`apps/api/tests/`), per the brief's explicit call-out that these
two must be code, not model output.

## Edge cases

| Case | Handling |
|---|---|
| Invalid/404/timing-out company URL | Recorded in `crawl.failures[]`; kit still generates from the JD + an honest empty brief |
| No hiring page anywhere on the site | `hiringPageFound: false`; question generation skips the system-design boost tied to a hiring page |
| Two-line JD | Extraction returns few/no requirements; question bank and schedule are thin and say so — nothing is invented |
| No public discussion found | `discussion: null` / empty snippets; brief doesn't fabricate interview-process claims |
| Invalid/incomplete LLM JSON | `llm.ts` retries with backoff, then the step's `try/catch` degrades that step only (empty result) rather than failing the whole kit |
| Rate limiting | Exponential backoff up to `LLM_MAX_RETRIES`; batch runs are designed to survive the retries within the 15-minute/5-case budget |
| Duplicate JD+company submission | Hashed and checked before generation; a repeat returns `DUPLICATE_KIT` with the existing kit's id instead of regenerating |
| 1-day / 60-day schedule | Handled arithmetically by the scheduler (see above); no special-casing needed |
| Structurally invalid kit | `validateKit.ts` hard-fails on shape violations (bad ids, duplicate ids, out-of-range difficulty/minutes) before persistence — but **uncovered must-haves are a coverage fact, not a structural failure**, so a thin-but-honest kit still saves as `status: "ok"` |

## Security

- `assertPublicUrl()` rejects `http`/`https`-only schemes, loopback/private/link-local literal IPs, and
  DNS names that resolve to a private range, whenever `ALLOW_PRIVATE_URLS=false` (the production default;
  it's `true` only for local dev and the batch evaluator's localhost fixtures).
- Fetches are restricted to `text/html`/`text/plain`/`application/xhtml+xml`, with a byte cap enforced
  both via `Content-Length` and while streaming.
- `htmlToText()` strips `<script>`/`<style>`/comments before any fetched page reaches the model — page
  content is treated strictly as data to summarise, never as instructions, and the same posture applies
  to the pasted JD.
- Auth uses `bcrypt`-hashed passwords and server-side sessions (`connect-mongo` store); every kit route
  filters by `userId`, so one user can never read or mutate another's kit.

## Practice mode

Confidence-weighted ordering: `score = (6 − lastConfidence) + daysSinceLastSeen`, unseen cards score
highest. Chosen over full SM-2 spaced repetition because a prep window is days, not weeks/months — there
isn't time for SM-2's growing intervals to matter, and "least confident first" is exactly what SM-2
approximates over a short horizon. Confidence per card and last-seen timestamp persist server-side and are
restored on reload, so "what's covered" survives a page refresh.

## Known limitations

- `search.ts`'s public-discussion lookup depends on whichever free search API is configured; it can return
  nothing for smaller/lesser-known companies, which is reported honestly rather than papered over.
- The crawler ranks links heuristically (keyword scoring) rather than following an ATS/careers-page schema,
  so an unusually named hiring page (no "careers"/"jobs"/"hiring" signal anywhere) can be missed.
- Regeneration granularity is per-section/per-category, not per-question — regenerating "technical"
  rebuilds all non-pinned/non-edited technical questions together rather than one at a time.
