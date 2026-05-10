# Plan: Practice test E2E (generation → grading → reports → performance tracker)

This document is the playbook for validating the **student practice pipeline** end-to-end: configuring topics, **AI generation**, taking the test, **submitting**, **grading**, **reports UI + PDF data**, and **performance_tracker** rollups.

Implementation lives in `tests/e2e/practice-full-subjects.spec.ts` (student Playwright project, serial, **one test per subject slot**).

---

## 1. Preconditions

### 1.1 Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `PLAYWRIGHT_USER_EMAIL` | Yes | Student login (must match seeded account with tracker rows) |
| `PLAYWRIGHT_USER_PASSWORD` | Yes | Student password |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase REST + auth base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Resolve user id via Admin API; read `performance_tracker`, `topics`, `test_reports` |
| `PLAYWRIGHT_BASE_URL` or `NEXT_PUBLIC_APP_URL` | Recommended | Same origin Playwright navigates (`http://127.0.0.1:3001` when using repo dev default) |

Optional:

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_STUDENT_USER_ID` | Asserts UUID from email lookup matches expected student |
| `PLAYWRIGHT_PRACTICE_E2E_SUBJECT_CAP` | Runs only first N subjects after sort (smoke / partial runs) |
| `PLAYWRIGHT_PRACTICE_E2E_MAX_SLOTS` | Max registered test slots (default 32); must be ≥ number of tracker-backed subjects |
| `PLAYWRIGHT_START_WEBSERVER=1` | Lets Playwright spawn `pnpm run dev` (see `playwright.config.ts`) |

### 1.2 Auth and data

1. **Auth setup** (`tests/e2e/auth.setup.ts`) runs before the student project and writes `playwright/.auth/user.json`.
2. The student must have **at least one** `performance_tracker` row per subject you expect to cover; subjects are discovered by grouping `performance_tracker` by `subject_id` and joining `subjects` for names and sort order.
3. Local **AI / subscription** requirements for generation and grading must be satisfied (API keys, quotas, `PRACTICE_SYNC_GRADING`, worker triggers, etc.) or the test will fail at generation or grading with UI alerts or long timeouts.

### 1.3 Server / URL stability

- Prefer a **manually started** `pnpm run dev` for long runs so the process is not tied only to Playwright’s webServer lifecycle.
- Keep **`PLAYWRIGHT_BASE_URL`** aligned with the dev server host/port (`localhost` vs `127.0.0.1` inconsistencies can cause confusing connection errors).

---

## 2. Execution model (one subject per Playwright test)

1. **`beforeAll`**: resolves `userId`, loads tracker-backed subjects, applies `SUBJECT_CAP`, logs ordered list (sort_order, then name).
2. Registers **≤ `PLAYWRIGHT_PRACTICE_E2E_MAX_SLOTS`** tests: `Practice · slot 1`, `Practice · slot 2`, …
3. For slot **i**, if `subjectsToRun[i]` exists → full flow runs; otherwise the test **`skip`**s (harmless placeholders).
4. **`test.describe.serial`**: subjects run **one after another**, never in parallel — avoids overlapping generations, quotas, and server load.

Running **only slot 3**:

```bash
pnpm exec playwright test tests/e2e/practice-full-subjects.spec.ts --project=student -g "slot 3"
```

Running **first subject only**:

```bash
PLAYWRIGHT_PRACTICE_E2E_SUBJECT_CAP=1 pnpm exec playwright test tests/e2e/practice-full-subjects.spec.ts --project=student
```

Full local sweep with auto-start dev server and `.env.local`:

```bash
NODE_OPTIONS='--require dotenv/config' DOTENV_CONFIG_PATH=.env.local \
PLAYWRIGHT_START_WEBSERVER=1 \
pnpm exec playwright test tests/e2e/practice-full-subjects.spec.ts --project=student
```

---

## 3. Phase-by-phase checklist (what each phase proves)

### Phase A — Wizard: subject → topics → config

| Step | Action | Pass criteria |
|------|--------|----------------|
| A1 | Open `/student/practice` | “Practice” heading visible |
| A2 | Click subject card (name from DB) | Card selects (state change) |
| A3 | Click **Continue** | **Topics** step visible (subject tap alone is not enough) |
| A4 | **Clear** (best effort), **Expand all** | Chapter/topic matrix visible |
| A5 | Check N random topics (1–4) | Checkboxes for `Select <topic_name>` match REST `topics.topic_name` |
| A6 | **Continue** → difficulty/time | **Save configuration** available |
| A7 | Choose easy (if present), **Save configuration** | “Ready to generate” summary visible |

### Phase B — Generation

| Step | Action | Pass criteria |
|------|--------|----------------|
| B1 | **Generate practice test** | Either **“Your test is ready”** dialog **or** a blocking **alert** (Something went wrong / Check this step) within timeout |
| B2 | On success | Dialog role + **Start test** |
| B3 | **Start test** | URL matches `/student/practice/<uuid>` |

**Failure modes to capture**: paywall, quota, model errors, stream 404 fallback, missing topics — surfaced as alerts (`waitForGenerationOutcome` races ready vs error headings).

### Phase C — Session: answer → submit

| Step | Action | Pass criteria |
|------|--------|----------------|
| C1 | Wait for session chrome | Primary **Submit test** visible |
| C2 | Answer up to ~5 questions | MCQ radios, `[data-practice-answer-field]`, or TipTap `.tiptap` |
| C3 | **Submit test** (card) → confirm dialog **Submit test** | Navigation away from attempt screen |

### Phase D — Grading

| Step | Action | Pass criteria |
|------|--------|----------------|
| D1 | URL | `/student/practice/<id>/grading` **or** direct `/student/reports` if synchronous grading completes quickly |
| D2 | **Poller + realtime** (app behavior) | Eventually `/student/reports` with highlighted row |

**Timeouts**: grading can take many minutes depending on AI worker and sync vs async (`PRACTICE_SYNC_GRADING`).

### Phase E — Report review (UI)

| Step | Action | Pass criteria |
|------|--------|----------------|
| E1 | Land on `/student/reports` | Row `#report-row-<testId>` visible (scrollIntoView semantics in product) |
| E2 | (Manual follow-up) | Open PDF route `/api/student/reports/<testId>/pdf` if you extend automation |

REST cross-check:

- Poll `GET /rest/v1/test_reports?test_id=eq.<uuid>&select=id,grading_error`
- Presence of row ⇒ report artifact path in pipeline succeeded enough to insert; **`grading_error`** non-null ⇒ warning in annotations / logs but row may exist.

### Phase F — Performance tracker (database)

**Before submit** (per selected topics):

- Snapshot `performance_tracker` for `(student_id, topic_id)`:
  - `tests_taken`
  - `updated_at`

**After grading completes** (poll up to deadline):

- For **each selected `topic_id`**, require either:
  - `tests_taken` increased, **or**
  - `updated_at` strictly newer than pre-snapshot

**Caveats**:

- Empty topic rollup after grading ⇒ tracker bulk RPC may skip; investigate `practice_update_trackers_bulk` / logs.
- Multiple tracker rows pointing at same logical topic behavior depends on schema — test uses **distinct `topic_id`** from sampled tracker rows.

---

## 4. Observability per run

Each subject test attaches **`NN-<subject>-selection.json`** with `subjectId`, sampled `topic_ids` / labels, `tracker_ids`, and `test_id`.

Playwright **annotations** include `practice_subject_slot_N` JSON with timings and warnings.

Console lines:

```text
[practice-full-subjects] ▶ SLOT k — Subject Name (uuid)
[practice-full-subjects] ◀ SLOT k OK (…) test_id=… warns=n
```

---

## 5. Ordering and limits

Subjects are sorted by **`subjects.sort_order`**, then name — **slot 1 = first in that list**.

If a student gains more tracker-backed subjects than `PLAYWRIGHT_PRACTICE_E2E_MAX_SLOTS`, **`beforeAll` fails explicitly** until you raise the env var or slice with `SUBJECT_CAP`.

---

## 6. Troubleshooting matrix

| Symptom | Likely cause |
|---------|----------------|
| Topics heading never appears | Missing **Continue** after subject tap |
| Generation timeout, no dialog | AI keys / route / quota; check alerts and server logs |
| `ERR_CONNECTION_REFUSED` mid-suite | Dev server crashed or stopped; stabilize webServer or run dev manually |
| Report row missing | Test still `grading`/`submitted`; RLS/report query filters; patience / worker |
| Tracker never bumps | Rollup empty; RPC failure; wrong `topic_id` expectation |

---

## 7. Definition of “complete test” (acceptance)

For **each** executed subject slot:

1. **Generation** produces an `tests` row and session at `/student/practice/<id>`.
2. **Submit** transitions to grading (or directly graded in sync mode).
3. **Reports UI** shows the attempt row for that `test_id`.
4. **`test_reports`** REST row exists for `test_id`.
5. **`performance_tracker`** rows for selected topics show **strict progress** vs pre-run snapshot.

When all non-skipped slot tests pass, the **full plan** for that student’s tracker-backed subjects is satisfied for this automation scope.
