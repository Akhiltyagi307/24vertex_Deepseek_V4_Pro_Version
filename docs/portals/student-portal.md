# 24Vertex — Student Portal

**Snapshot:** 2026-06-12 · branch `main` @ `27d7fbb`. The §8 status tags were re-verified against current code on this date (superseding the 2026-05-31 snapshot @ `8f69969`).
**Product:** 24Vertex (technical slug `vertex24`; legacy `eduai`)
**Audience for this doc:** mixed. Sections tagged **[Plain]** are written for any human reader (students, parents, business, support). Sections tagged **[Technical]** are written densely for engineers and LLMs and name concrete files, tables, routes, and data flows.
**Scope:** everything under `app/student/**`, `app/api/student/**`, `src/lib/practice/**`, `src/lib/doubt/**`, `src/lib/student/**`, `src/components/student/**`.

---

## 1. What the Student Portal is — [Plain]

The Student Portal is the heart of 24Vertex. It is where a school student (grades 6 to 12, following the Indian NCERT curriculum) actually studies. A student logs in and can:

- **Generate a practice test on any chapter or topic**, instantly, written fresh by AI.
- **Take that test** in a focused, timed, exam-like screen.
- **Get it graded automatically**, with marks, model answers, and personalised feedback.
- **Ask a doubt** to an AI tutor that explains, quizzes, or solves step-by-step with them.
- **See how they are improving** over time, topic by topic, subject by subject.
- **Get short, automatic review tests** on topics they previously got wrong, timed for just before they would forget (spaced repetition).
- **Do work their teacher assigned** and have it count — whether the teacher let the AI write it or wrote every question by hand.
- **Stay motivated** through weekly activity streaks and a leaderboard.

In short: it turns a phone or laptop into a private tutor and an endless, curriculum-aligned question bank.

---

## 2. How the Student Portal fits the wider platform — [Plain]

The student is the centre of gravity. Everyone else on the platform is looking at, supporting, or supplying the student:

- **Parents** link to the student and watch their progress (read-only oversight) and can pay for the plan.
- **Teachers** assign tests to the student and review how the whole class did.
- **Admins** keep the content (subjects, chapters), the AI, the billing, and safety running behind the scenes.

So almost every piece of data a student creates — a test, an answer, a doubt, a score — becomes something a parent, teacher, or admin can later use.

---

## 3. Current technical setup — [Technical]

### 3.1 Stack and where it lives
- **Framework:** Next.js 16 (App Router, React 19, Server Components + Server Actions), TypeScript, deployed on Vercel.
- **Data:** Supabase Postgres accessed two ways — Drizzle ORM (`src/db/schema/*.ts`) for typed server queries, and the Supabase JS client (`@supabase/ssr`) for RLS-scoped reads and Realtime.
- **Auth:** Supabase Auth (email/password). The signed-in user maps to a `profiles` row with `role = 'student'`.
- **Storage:** Supabase Storage buckets (e.g. `doubt-attachments`, generated report PDFs).
- **AI:** Vercel AI SDK v6 (`ai`, `@ai-sdk/deepseek`, `@ai-sdk/openai`, `@ai-sdk/react`) behind a custom model router (`src/lib/ai/model-router.ts`) — DeepSeek primary (cost), OpenAI fallback (capability).
- **UI:** Tailwind v4 + shadcn/Radix primitives; charts via Recharts + Plotly (`plotly.js-dist-min`) + Mafs + `function-plot`; math via KaTeX (`katex`, `rehype-katex`, `remark-math`); PDFs via `@react-pdf/renderer` + `@react-pdf/math`; rich text via TipTap; chemistry via `smiles-drawer`; diagrams via Mermaid/Three.
- **Observability:** Sentry (`sentry.*.config.ts`, `instrumentation.ts`); rate limiting via Upstash Redis (`src/lib/ratelimit/**`).

### 3.2 Access and authentication
- Login is a server action (`app/(auth)/login/actions.ts`) that signs in, reads the profile, and `redirect()`s by role. Login, signup, and password-reset actions are app-level rate-limited via `src/lib/auth/rate-limit.ts` (account-first keying so a shared school IP isn't collectively locked out; fail-closed in prod on limiter-infra error).
- The portal is guarded by `app/student/layout.tsx` via `requireVerifiedStudent()` (`src/lib/auth/require-verified-student.ts`), part of the shared `requireUser({ role })` helper family (`src/lib/auth/require-user.ts`). It asserts authenticated + `role === 'student'` + not suspended/soft-deleted. The shell (`src/components/student/student-shell.tsx`, `student-app-sidebar.tsx`, `student-top-bar.tsx`) renders the nav.
- A global signed-out listener (`src/components/auth/auth-signed-out-listener.tsx`) broadcasts logout across tabs.
- Middleware `proxy.ts` handles maintenance routing and origin checks (see §3.7).

### 3.3 Data model — tables this portal reads/writes
*(Drizzle definitions in `src/db/schema/`.)*

| Table | Role in the student portal |
|---|---|
| `profiles` | The student record: `fullName`, `role`, `grade`, `section`, `stream`, `electiveSubjectId`, `schoolName`, `parentEmail`, `studentLinkCode` (8-char code parents use to link), `organizationId`, `isSuspended`, `deletedAt`, `onboardingWelcomeSeenAt` (cross-device gate for the first-run welcome dialog). |
| `subjects` / `topics` | Curriculum tree: subject (per grade/stream/elective) → unit → chapter → topic, with `learningObjectives`. Drives what a student can practice. |
| `tests` | One practice test attempt: `studentId`, `subjectId`, `testType` (`self` / `assigned` / `review`), `status` (`in_progress`/`completed`/…), `timeLimitSeconds`, `totalScore`, `clientRequestId` (idempotency key for durable async generation; unique per student via `uq_tests_student_client_request_id`), integrity fields (`tabBlurCount`, `deviceFingerprint`, `lastIp`, `isPaused`, `adminExtensions`, `accumulatedPauseSeconds`). |
| `questions` | Generated questions: `questionText`, `questionType`, `answerKey` (jsonb), `options`, `metadata` (visuals etc.), `embedding` (pgvector 1536 for dedup). |
| `student_answers` | Per-question response: `studentAnswer` (jsonb), `isCorrect`, `scoreEarned`, `aiFeedback`, `aiUserAnswerSummary`, `aiReferenceAnswerSummary`, `timeSpentMs`, `visits`, `flaggedForReview`. |
| `test_reports` | Graded report: `summaryReport` (jsonb), `strengths[]`, `improvementAreas[]`, `aiInsights`, `topicPerformance`, `recommendations[]`, `pdfStoragePath`. |
| `question_flags` | Student "this question looks wrong" reports. |
| `performance_tracker` | Per-(student, topic) mastery: `status`, `averageScore`, `testsTaken`, `confidenceScore`, `trend`. The analytics backbone. Now also carries the SM-2-lite review schedule: `nextReviewAt`, `reviewIntervalDays`, `reviewEase`, `consecutiveGood` (+ partial index `idx_perf_next_review` for the nightly selector). |
| `practice_jobs` | Async queue for generation/grading work. Job types now include `assign_generate_test`, `review_generate` (nightly review-loop materialisation), and `student_generate_test` (durable student-initiated generation, keyed by `payload->>'client_request_id'`). |
| `assignment_questions` | Teacher-authored question templates for **manual** assignments; copied verbatim into `questions` rows (no LLM) when the student opens the assignment (`practice_create_manual_assigned_test` RPC). |
| `practice_generation_runs` / `practice_generation_steps` | Telemetry per generation: tokens, latency, per-stage status. |
| `practice_analytics_events` | Funnel/usage events for the practice flow. |
| `doubt_conversations` / `doubt_messages` / `doubt_message_attachments` | AI tutor threads, messages (with `tutorMode`), and uploaded images/PDFs (with `ocrText`). |
| `student_activity_streaks` | Weekly streak counters + reward grant tracking, plus streak-freeze state: `bridgedWeeks` (date[] of forgiven missed weeks), `freezesAvailable`, `freezeLastUsedWeek`. Recomputed gaps-and-islands over real ∪ bridged weeks by `refresh_student_activity_streak` / `compute_student_activity_streak_bridged`; gated by `streak_freeze_enabled()`. |
| `subscriptions` / `usage_periods` / `quota_grants` | Plan + per-period test/token quotas the portal consumes against. |
| `notifications` (via `src/lib/notifications/**`) | In-app notifications (report ready, assignment, usage threshold, trial reminders, review ready). |

### 3.4 Routes (pages)
All under `app/student/`:
`dashboard`, `practice` (+ `practice/[testId]` for the live session/report, `practice/actions/`), `doubt-chat`, `assignments`, `performance`, `reports` (+ `reports/[subjectId]`), `qna-logs`, `notifications`, `settings` (+ `settings/sections/`), `subscription`, `ai`.

### 3.5 Server actions & API routes
- **Practice API** (`app/api/student/practice/`): `generate-stream` (NDJSON-streamed generation), `generate` + `generate/status` (durable async generation: enqueue a `student_generate_test` job, poll progress by `client_request_id`; flag-gated by `PRACTICE_ASYNC_GENERATE`, default-on outside prod), `batch-upsert-answers`, `flag-question`, `session-meta`, `tab-blur`, `abandon-submit`.
- **Practice actions** (`app/student/practice/actions/`, `session-actions.ts`): create/configure, finalize/submit, abandon, `appendAdaptiveFollowups` (mid-test extra questions — now AI-token-gated via `canStartDoubtChat`, debits `consumeTokens`, 60s abort timeout). Ownership is re-checked against `tests.studentId` (`src/lib/practice/test-ownership.ts`).
- **Internal cron/worker routes feeding the portal:** `/api/internal/practice/run-jobs` (claims `grade`/`assign_generate_test`/`review_generate`/`student_generate_test`/… via `practice_claim_jobs`), `/api/internal/practice/auto-submit-expired`, `/api/internal/practice/review-scheduler` (nightly pg_cron @ 02:30 UTC — enqueues review generation for due topics).
- **Doubt API** (`app/api/student/doubt-chat/`): streamed tutor turns; backed by `src/lib/doubt/doubt-actions.ts`.
- **Reports API** (`app/api/student/reports/[testId]` + `/pdf`): JSON report + on-demand React-PDF render (signed URL via `src/lib/practice/student-test-report-pdf-signed-url.ts`).
- **Notifications API** (`app/api/student/notifications/` + `[id]`, `read-all`, `unread-count`).
- **Assignments API** (`app/api/student/assignments/` + `open-indicator`).
- **Billing API** (`app/api/student/billing/checkout-event`).
- **Activity streak** (`app/api/student/activity-streak`).
- **QnA logs** (`app/api/student/qna-logs/` + `[answerId]`, `nav`).

### 3.6 AI: the practice generation + grading pipelines
The flagship system. Entry point `src/lib/practice/practice-generation-pipeline.ts`; provider abstraction `src/lib/ai/structured-output.ts` (bifurcates OpenAI strict structured output vs DeepSeek JSON mode, which lacks `generateObject`).

**Generation stages** (each a module under `src/lib/practice/`):
1. **Config resolve** (`resolve-config.ts`) — subject/topics/difficulty/question mix.
2. **Quota preflight** (`src/lib/billing/entitlements.ts → preflightPracticeTestQuota`) — does not increment yet.
3. **Blueprint** — deterministic (`practice-generation-blueprint-deterministic.ts`) or LLM (`practice-generation-blueprint.ts`).
4. **Evidence pack / RAG** (`generation-evidence-pack.ts`, `topic-context-chunks.ts`) — grounds questions in curriculum chunks (`topic_context_chunks`).
5. **Batched generation** (`practice-generation-batches.ts`, `*-batch-budget.ts`, `*-batch-sister-brief.ts` for cross-batch coherence).
6. **Editor pass** (`practice-generation-batch-editor.ts`).
7. **Repair** (`practice-generation-repair.ts`) + **deterministic autofix** (`practice-generation-autofix.ts`) + **single-question replacement** (`practice-generation-replacement.ts`).
8. **Quality gates** (`practice-generation-quality-gates.ts`) — near-duplicate (pgvector embeddings, `dedup-embeddings.ts`), topic concentration, visual alignment, chunk alignment.
9. **Validation** (`practice-validation.ts`) + **audit/normalize** (`practice-generation-batch-audit.ts`) + KaTeX normalize (`katex-math-normalize.ts`) + JSONB sanitize.
10. **Moderation** pre/post (`src/lib/ai/moderation.ts`).
- **Resilience:** model router with failover (`model-router.ts`), reason-aware retries (`ai-retry.ts`, `practice-generation-retry-policy.ts`), low-context fallback (`practice-low-context-fallback.ts`).
- **Streaming:** NDJSON stage envelope (`generate-stream-envelope.ts`) feeds the wizard incrementally; the ~15 telemetry stepKeys are collapsed into 5 stable, monotonic checklist buckets (`generation-progress-buckets.ts`) rendered by `generation-overlay.tsx` / `practice-progress-checklist.tsx`.
- **Durable async path (flag-gated):** `POST /api/student/practice/generate` enqueues a `student_generate_test` job and returns; the worker runs the same pipeline server-side (`src/lib/practice/student-generation.ts`) and persists via the idempotent `practice_generate_self_test` RPC keyed on `tests.client_request_id`, so it survives the 300s function ceiling, client disconnects, and reclaims without double-charging. The wizard polls `generate/status` (run linked via `practice_generation_runs.correlation_id = client_request_id`). Off in prod unless `PRACTICE_ASYNC_GENERATE=true` (+ `NEXT_PUBLIC_PRACTICE_ASYNC_GENERATE` for the wizard branch); streaming stays the default.
- **Telemetry:** `generation-telemetry.ts` → `practice_generation_runs` / `_steps`; `request_mode ∈ {server_action, stream, assignment_worker, review_worker}` (DB CHECK widened so worker-mode runs persist).
- **Visuals:** spec-driven renderers in `src/components/student/practice/visuals/renderers/` (geometry, statistics charts via Plotly, physics, chemistry via SMILES); exemplars in `src/lib/practice/visuals/`.

**Grading pipeline:** `src/lib/practice/ai-grade-practice-test.tsx` + `grading-*.ts` (prompts, schema, normalize, feedback format). On submit, each answer is scored, model/user answer summaries written to `student_answers`, a `test_reports` row produced, `performance_tracker` updated (`topic-rollup.ts`), and a "report ready" notification + email fired. In-flight "Graded N of M" progress is written best-effort to `practice_jobs.payload` and polled by the grading view (5-bucket checklist via `grading-progress-buckets.ts`). The same tracker write atomically advances each topic's SM-2-lite review schedule (`review-schedule-payload.ts` → `practice_update_trackers_bulk`), and graded `review` tests emit per-topic `review_test_completed` before/after events.

**Review loop (closed learning loop):** `src/lib/practice/review-schedule.ts` is the pure SM-2-lite scheduler (enter at 2 days on a failed topic [<75%], reset to 1 day with ease −0.2 on a repeat fail, interval ×ease on a pass, graduate after 3 consecutive passes). The nightly `review-scheduler` route selects due trackers (`next_review_at ≤ now`), applies the staged-rollout cohort gate (`review-cohort.ts`: org allowlist `review_scheduler_cohort_org_ids()` OR FNV-1a percentage bucket `review_scheduler_rollout_pct()`, under the global `review_scheduler_enabled()` kill-switch) and per-student caps (`review-selection.ts`: skip if no quota, ≥8 review tests this period, or any review activity today), then enqueues `review_generate` jobs (deduped by a partial unique index). The worker (`src/lib/practice/review-generation.ts`) generates a medium-difficulty test biased to the weak topic, persists via `practice_generate_review_test` (`test_type='review'`), and sends a `review_ready` notification deep-linking to the test. **Defaults are dormant:** rollout pct 0 + empty org allowlist ⇒ nobody, until deliberately widened.

### 3.7 Cross-cutting services
- **Billing gates:** `consumeTest` (decrement test quota, **fail-closed** on infra error; refundable via `refundTest` if persistence fails) and `canStartDoubtChat` / `consumeTokens` (output-token quota). Controlled by `SAAS_ENFORCEMENT`; `staffOverride` bypasses.
- **Notifications:** `src/lib/notifications/**` writes in-app rows + Resend emails (report-ready, usage-threshold 80/100%, trial reminders, assignment events, `review_ready` with a "Start review" deep link). Bell queries are backed by composite `(recipient_id, created_at DESC)` indexes (+ a partial unread index).
- **Security:** per-user rate limiting on every student API route via `consumeStudentRateLimit` (`src/lib/student/rate-limit.ts`, buckets `student:<bucket>:user:<id>` over `src/lib/ratelimit`; fail-closed in prod/preview on circuit-open) — covers practice mutations (`batch-upsert-answers`, `flag-question`, `tab-blur`, `session-meta`, `abandon-submit`) and the notification/streak/assignment reads; CSP (`src/lib/security/csp.ts`), origin guard (`src/lib/security/origin-guard.ts`), moderation, attachment MIME/size limits, server-side sanitizer for rich practice answers at the single write choke point (`rich-answer-sanitize-server.ts` in `student-answer-write.ts`).
- **Realtime:** test row polling/realtime (`use-test-row-realtime-poll.ts`) so admin pauses/extensions and async grading reflect live.

---

## 4. Capabilities, feature by feature

Each capability below has a **[Plain]** "what the student does" line and a **[Technical]** "how it works" line.

### 4.1 Generate a practice test
- **[Plain]** The student picks a subject and chapter/topic(s), chooses how hard and how many questions, and the app writes a brand-new test for them in seconds — with diagrams, graphs, and proper math where needed. No two tests are identical.
- **[Technical]** `practice-test-wizard.tsx` posts config → `generate-stream` NDJSON route → `practice-generation-pipeline.ts` runs the staged pipeline (§3.6), streaming stage envelopes that drive a 5-step checklist with "Drafted N of M" counts (`generation-progress-buckets.ts`, monotonic `onStage`). Questions persisted to `questions` (with `answer_key`, `options`, `embedding`); the `tests` row opens in `in_progress`. Quota preflighted, then `consumeTest` on persist. A flag-gated durable branch enqueues + polls instead of streaming (§3.6, `PRACTICE_ASYNC_GENERATE`).

### 4.2 Take a test (exam-like session)
- **[Plain]** A clean test screen with a countdown timer. Answers save automatically as they go, they can flag confusing questions, jump between questions, and submit when done (or it auto-submits when time runs out).
- **[Technical]** Session UI in `src/components/student/practice/practice-test-session/`. Autosave via `batch-upsert-answers`; `session-meta` + `tab-blur` track focus loss (`tabBlurCount`) and device/IP for integrity; `abandon-submit` and the internal `auto-submit-expired` cron close stale sessions. Timer honours `timeLimitSeconds`, operator `isPaused`, and `adminExtensions`. Live state via realtime poll.

### 4.3 Automatic AI grading + graded report
- **[Plain]** Right after submitting, the student gets a score, sees which answers were right or wrong, reads the correct/model answer, and gets specific feedback on what to fix — plus strengths, weak areas, and study recommendations. Downloadable as a PDF.
- **[Technical]** Grading pipeline (§3.6) writes `student_answers.scoreEarned/aiFeedback/...` and a `test_reports` row (`strengths[]`, `improvementAreas[]`, `recommendations[]`, `topicPerformance`). While grading runs the student sees a 5-step checklist with live "Graded N of M" (`grading-progress-buckets.ts` polling `practice_jobs.payload`). Report UI `student-reports-view.tsx`; PDF via `@react-pdf/renderer` (`practice-grading-pdf-document.tsx`, `-visual.tsx`) served through a signed URL. `performance_tracker` updated atomically — including the topic's review schedule (§4.11).

### 4.4 Ask a doubt (AI tutor)
- **[Plain]** A chat with an AI tutor scoped to their syllabus. Three styles: **Explain** (teach me this), **Solve with me** (walk through step-by-step, with collapsible solution steps), and **Quiz me** (test me with questions). They can upload a photo of a worksheet or a PDF and ask about it. From any graded wrong answer in their QnA log, one tap on **"Ask about this"** opens a chat where the tutor already knows the question, what they answered, the correct answer, and the grader's feedback. A **"Practice this topic"** button jumps from the chat into the test wizard. Math and diagrams render properly.
- **[Technical]** `doubt-chat` UI streams via `app/api/student/doubt-chat` + `@ai-sdk/react`. Modes `explain | solve_with_me | quiz_me` (`doubt-tutor-mode.ts`). Subject packs (`docs/doubt-subject-packs/*.md`, 12 subjects) + shared preamble shape the system prompt; `safety.ts`/`safety-detectors.ts` run a deterministic safety screen (hardened: single representative `source` per moderation flag with the full breakdown in `reason`; sexual-violence terms moved to a review-only "sensitive topic" tier so curricular questions still get answered; ReDoS-guarded admin blacklist; blocked-turn audit writes awaited before the 422). `scope-precheck.ts`/`validate-doubt-scope.ts` keep it on-syllabus. **Mistake grounding:** `createDoubtConversation({ mistakeContext: { questionId } })` loads the wrong answer ownership-checked (`src/lib/doubt/mistake-context.ts` — test must belong to the student, answer must be incorrect), injects a `{{mistake_block}}` into the prompt scope, and persists it in `doubt_conversations.metadata.mistakeBlock` so per-turn resumes stay grounded; entry button on `qna-log-detail-dialog.tsx`. Attachments → Storage `doubt-attachments`, OCR via `tesseract.js` populates `ocrText`. Persisted to `doubt_conversations`/`doubt_messages`. Gated by `canStartDoubtChat`; token pre-debit happens only **after** conversation-ownership + scope checks; output tokens reconciled via `consumeTokens`; request body capped at 1000 messages. Markdown/KaTeX rendering preserves display math inside lists and keeps adjacent inline formulas distinct (`tutor-markdown.tsx`, `tutor-math.ts`).

### 4.5 Performance analytics
- **[Plain]** A dashboard showing how the student is doing per subject and per topic — what they've mastered, what's shaky, and whether they're trending up or down — so they know exactly what to revise next.
- **[Technical]** `student-performance-view.tsx` reads `performance_tracker` (per-topic `status`, `averageScore`, `confidenceScore`, `trend`) rolled up by subject. Charts via Recharts. Mastery recomputed after each graded test (`topic-rollup.ts`). The per-topic sheet (`performance-topic-sheet.tsx`) shows a "You're improving here" celebration on an improving trend; derived educator/parent mastery bands (`src/lib/student/mastery-states.ts`: not started / familiar / proficient / mastered) render only for the parent viewer of the shared component.

### 4.6 Reports & QnA logs
- **[Plain]** A history of every test taken (per subject) and a searchable log of every question they answered with the feedback they got — a personal revision archive.
- **[Technical]** `reports`/`reports/[subjectId]` over `tests` + `test_reports`; `qna-logs` paginates `student_answers` joined to `questions` with prev/next nav (`qna-logs/nav`). The detail dialog offers "Ask about this" on incorrect/partial answers, spawning a mistake-grounded doubt chat (§4.4).

### 4.7 Assignments from teachers
- **[Plain]** Tests a teacher set appear here with due dates. The student opens one, takes it like any other test, and the result flows back to the teacher. Teachers can either let the AI write the questions or author every question (and answer key) by hand — the student experience is identical.
- **[Technical]** `assignments` page reads `assignment_submissions` (joined to `assignments`). Opening triggers materialisation of a `tests` row via a `practice_jobs` `assign_generate_test` job; on submit the submission's `score`/`lifecycleStatus`/`isLate`/`penaltyApplied` update. `open-indicator` surfaces unstarted work. **Manual assignments** (`authoring_mode: 'manual'`, `src/lib/assignments/manual-*.ts`): materialisation forks to a no-LLM "copy" path — teacher-authored `assignment_questions` templates become ordinary `questions` rows via `practice_create_manual_assigned_test`; grading, tracking, reports, and PDFs are reused unchanged (MCQ scoring extended to options A–F; tolerant manual answer-key formatter on the PDF + QnA review).

### 4.8 Notifications
- **[Plain]** A bell with updates: "your report is ready", "new assignment", "time for a quick review", "you're near your monthly limit", trial reminders.
- **[Technical]** `notifications` + API (`unread-count`, `read-all`, `[id]`). Rows written by `src/lib/notifications/**`; some mirrored to email via Resend. `review_ready` rows carry `referenceType='test'` and render a "Start review" action deep-linking to `/student/practice/[testId]` (`src/lib/notifications/types.ts`).

### 4.9 Activity streak & leaderboard
- **[Plain]** Practising in a week keeps a streak alive; longer streaks earn rewards, and a leaderboard adds friendly competition. Missing a single week no longer wipes the streak — a "freeze" bridges it, and the freeze is earned back by staying active. The widget shows deadline, streak count, and freeze state at a glance in a gamified tray.
- **[Technical]** `student_activity_streaks` (`streakWeeks`, `currentWeekActive`, `longestStreakWeeks`, `rewardGrantedAt`, plus freeze fields §3.3); widgets `activity-streak-widget.tsx` (state-colored icon + tray; server-seeded snapshot trusted for 60s, focus-refetch only while the tray is open, zod-validated responses), `student-dashboard-leaderboard-card.tsx`; updated via `app/api/student/activity-streak`. Freeze logic in `refresh_student_activity_streak` (one bridged week per freeze, re-earned after ≥4 active weeks past the bridge; frozen weeks count toward the 52-week reward; kill-switch `streak_freeze_enabled()`). Rewards can mint `quota_grants`.

### 4.10 Settings & subscription
- **[Plain]** Edit profile (name, grade, school, avatar), choose which notifications to receive, change password, and manage the plan — see how many tests/AI credits are left this period and upgrade if needed. Pro is ₹600/month or ₹6,000/year (2 months free vs monthly).
- **[Technical]** `settings/sections/` + action files (profile, account-security, notification-preferences) with shared form styles (`_settings-form-styles.ts`, also adopted by the parent portal). `subscription` reads `getCachedEntitlements()` (plan, `testsLeft`, `tokensLeft`, trial days, status). Checkout via Razorpay; plan prices in `src/lib/billing/plans.ts` + `plans` table (`pro_monthly` 60000 paise, `pro_annual` 600000); account-security uses the role-agnostic `src/lib/auth/account-security-actions.ts`. A paused Razorpay subscription is treated as no-access by the entitlement gate.

### 4.11 Spaced-repetition review tests (closed learning loop)
- **[Plain]** When a student does badly on a topic, the app quietly schedules a short follow-up test for a couple of days later — then spaces the follow-ups further and further apart as the student keeps passing, until the topic "graduates". The test appears overnight with a notification: "Time for a quick review." It costs a normal test credit but is capped so it never eats the whole monthly quota.
- **[Technical]** The full loop of §3.6: grade-time SM-2-lite advance (`review-schedule.ts` + `review-schedule-payload.ts`, persisted atomically by `practice_update_trackers_bulk`), nightly selector (`/api/internal/practice/review-scheduler`, pg_cron 02:30 UTC) with kill-switch + staged-rollout cohort gate (`review-cohort.ts`) and caps (`review-selection.ts`: quota, 8-per-period sub-budget, ≤1/day), background materialisation (`review-generation.ts` → `practice_generate_review_test`, `test_type='review'`), and a `review_ready` notification. Before/after telemetry per graded review test (`review_test_completed` in `practice_analytics_events`). The advisory ranker over the same schedule (`src/lib/student/review-advisory.ts`: overdue → due-soon → weak) currently surfaces on the **parent** performance page and the teacher summary card, not in the student portal. **Rollout state: dormant by default** (pct 0, empty org allowlist).

### 4.12 Guided onboarding (first run)
- **[Plain]** New students get a friendly welcome, a short guided tour of the portal, and a dismissible checklist on the dashboard ("generate your first test", "ask a doubt", …) with a progress bar. The tour can be replayed anytime from a compass button in the top bar.
- **[Technical]** Shared engine in `src/components/onboarding/` (`coach-marks.tsx` spotlight tour, `welcome-dialog.tsx`, `use-onboarding-flag.ts`, `tour-replay.ts` pub/sub + `tour-replay-top-bar-button.tsx`); student orchestration `student-onboarding.tsx` (welcome → play-first → tour → doubt-mode tooltips) + dashboard `onboarding-checklist.tsx` keyed off `isNewStudent` (`load-student-dashboard.ts`). "Welcome seen" is durable cross-device via `profiles.onboarding_welcome_seen_at` (`markWelcomeSeen()` in `src/lib/onboarding/welcome-actions.ts`), separate from the checklist gate. Mobile skips the sidebar-anchored tour; the tour overlay portals to `<body>` with the page inert (a11y).

---

## 5. How the Student Portal benefits the student — [Plain]

- **A tutor that never sleeps.** Stuck at 11pm? The AI tutor explains, quizzes, or solves alongside them — patiently, as many times as needed.
- **Unlimited, fresh practice.** Instead of redoing the same textbook questions, every test is newly written for the exact chapter they're revising, at the difficulty they choose.
- **Instant, honest feedback.** No waiting days for marking. They see what they got wrong, the right answer, and *why* — immediately, while it's still fresh.
- **A clear map of what to study next.** The performance tracker turns vague anxiety ("am I ready?") into a concrete list: "you're strong here, weak there, revise this."
- **Exam realism.** The timed, focused test screen builds exam temperament, not just knowledge.
- **Motivation built in.** Streaks, rewards, and a leaderboard make consistency feel rewarding instead of a chore.
- **Fair and safe.** The tutor stays on-syllabus and is safety-screened, so it's a study tool — not a distraction or a risk.

---

## 6. How the Student Portal benefits everyone else — [Plain]

**Parents**
- Every test, score, and trend the student produces becomes something a parent can see in their own portal — real evidence of effort and progress, without nagging.
- Parents get peace of mind: the content is curriculum-aligned and the AI is safety-screened.
- It can save money on private tuition by covering practice and doubt-clearing at home.

**Teachers**
- When a teacher assigns work, the student does it here and the results flow straight back — no manual collection or marking.
- The mastery data students generate lets teachers see, at a glance, which topics a class is struggling with, so class time targets real gaps.
- The AI does the heavy lifting of writing and grading questions, freeing teachers for actual teaching.

**Schools / coaching institutes (organizations)**
- A whole cohort gets consistent, on-syllabus practice and measurable outcomes — useful for tracking and for parent communication.

**The business (24Vertex)**
- The student portal is where value is delivered and where usage happens, so it drives subscriptions and renewals.
- Rich, anonymisable usage and quality signals (generation telemetry, question flags, performance trends) feed continuous improvement of the AI and content.
- Engagement features (streaks, leaderboard, assignments) increase retention and word-of-mouth.

**Content & AI quality (internal)**
- "Flag this question" reports and grading telemetry create a feedback loop that surfaces weak content and weak prompts for the admin/content team to fix.

---

## 7. Honest limitations & current edges — [Technical]

- The generation pipeline has no independent **answer-key verifier** (a second model that re-solves and checks the stated answer) — the highest-value reliability gap; quality currently rests on repair + gates + validation.
- No **distractor-quality judge**, **self-consistency ensemble**, **VLM judge for diagrams** (visual gates are lexical), or **reading-level gate** yet.
- The **review loop is built but dormant in production**: `review_scheduler_rollout_pct()` defaults to 0 and `review_scheduler_cohort_org_ids()` to empty, so no student receives review tests until a cohort is deliberately populated (the nightly cron and kill-switch are live). One due topic per student per night; the "what to focus on next" advisory ships only on parent/teacher surfaces, not the student portal.
- **Durable async generation is flag-gated off in prod** (`PRACTICE_ASYNC_GENERATE`): the default streaming path still runs the whole pipeline inside one request, so a very long generation can hit the serverless ceiling (a tail-guard mitigates; the durable job path removes the risk once enabled).
- The mistake-grounded "Ask about this" entry exists only on the QnA-log detail dialog — not yet on the graded report view itself.
- CSRF/origin gating covers mutating `/api/student/*` routes (`studentProxyGate`), and **all** student API routes — including `flag-question` and the practice mutations — carry per-user rate limits (`consumeStudentRateLimit`); the 2026-05-17 audit's "no CSRF gate" finding and the earlier "no practice-mutation rate limits" remainder are both resolved.
- Heavy client components and chart libs (Recharts/Plotly) affect first-load performance on some pages (shape-matched `loading.tsx` skeletons now cover settings/subscription/assignments/doubt-chat).
- Accessibility of practice visuals (ARIA descriptions for screen readers) is a known work item.

---

## 8. PDR-style specification — current code state (for LLM planning)

> **How to read this section.** It mirrors the project's canonical *Product Design Requirements* (PDR v3.0), which lives outside the repo but is referenced inline in code as `PDR §x.y`. Student/practice features belong to the **core PDR** (`supabase/migrations/20260412000001_eduai_pdr_v3_core.sql`); operator controls over live tests are **PDR §4.28**; AI-output moderation is **PDR §4.27**.
> Each requirement has a stable local ID (`STU-R#`), a **Status** in `[BRACKETS]`, file **evidence**, and (for gaps) a **Hook:** line telling an implementing agent exactly where to make the change.
> **Status legend:** `[IMPLEMENTED]` = present & exercised in code · `[PARTIAL]` = present but incomplete/needs hardening · `[GAP]` = not built · `[PLANNED]` = designed, not started.

### 8.1 Entity state machines

**Practice test — `tests.status`** (persisted: `src/db/schema/assessment.ts`)
```
status ∈ { in_progress | grading | grading_failed | graded }   (confirmed enum)
(create) ──▶ in_progress ──▶ grading ──▶ graded          (terminal: success)
                  │              │
                  │              └──────────▶ grading_failed  (terminal: failure)
                  │                 (tests.status='grading_failed'; test_reports.gradingFailedAt/gradingError;
                  │                  report UI = grading-error-ui.ts; admin regrade ⇒ grading → graded)
                  └─ orthogonal flags (do NOT change status):
                     isPaused (operator, PDR §4.28) · autoSubmitted · abandonedAt ·
                     adminExtensions · accumulatedPauseSeconds
```
- Triggers into `grading`: student submit (`submit-practice-shared.ts`), timer expiry (`/api/internal/practice/auto-submit-expired`), `abandon-submit` (when answers exist).
- Grade step writes `student_answers.*`, a `test_reports` row, and rolls up `performance_tracker` (`topic-rollup.ts`) — atomically advancing each topic's review schedule (below).
- Integrity counters accrue during `in_progress`: `tabBlurCount` (`/api/student/practice/tab-blur`), `deviceFingerprint`, `lastIp`.
- `tests.test_type ∈ { self | assigned | review }` (CHECK, migration `20260704010000`); `tests.client_request_id` (unique per student when present) is the idempotency key for the durable async generation path.

**Review schedule — per `(student, topic)` on `performance_tracker`** (pure fn: `src/lib/practice/review-schedule.ts`; persisted by `practice_update_trackers_bulk`)
```
unscheduled ──(topic score < 75)──▶ scheduled @ 2d, ease 2.0
scheduled   ──(fail)──▶ reset @ 1d, ease −0.2 (floor 1.3), consecutive_good = 0
scheduled   ──(pass)──▶ interval × ease, ease +0.1 (cap 2.6), consecutive_good++
scheduled   ──(3 consecutive passes)──▶ GRADUATE (next_review_at = NULL, drops out of nightly selection)
nightly: next_review_at ≤ now → cohort gate → caps → practice_jobs(review_generate) → test_type='review'
```

**Generation run — `practice_generation_runs.status`** (persisted: `src/db/schema/practice-tables.ts`)
```
running ──▶ succeeded
       └──▶ failed (failureCode, failureMessage)
per-stage: practice_generation_steps.status (one row per pipeline stage, §3.6)
```

**Async work — `practice_jobs.status`** (persisted: `practice-tables.ts`)
```
pending ──▶ running ──▶ done
                   └──▶ failed   (attempts++ up to maxAttempts=3; runAfter backoff)
job_type ∈ { grade | pdf | auto_submit | email | tracker_update |
             assign_generate_test | review_generate | student_generate_test }
claim order: grade → assign_generate_test → review_generate → pdf → email → … (practice_claim_jobs)
reclaim: stale leases recovered off claimed_at (not updated_at); completion fenced on claimed_by
processor: /api/internal/practice/run-jobs
```

**Entitlement gate — `subscriptions.status`** (derived: `src/lib/billing/entitlements.ts`)
```
trialing | active | coupon | grace        → access allowed while quota remains
past_due | cancelled | expired | paused   → canStartTest=false, canChatDoubt=false
period elapsed (currentPeriodEnd ≤ now)   → effectiveStatus coerced to "expired"
gates: canStartTest = testsLeft>0 ; canChatDoubt = tokensLeft>0
overrides: staffOverride OR SAAS_ENFORCEMENT=false ⇒ always allowed
```

### 8.2 Functional requirements & current status

| ID | Requirement | Status | Evidence | PDR |
|---|---|---|---|---|
| STU-R1 | Generate a fresh, curriculum-grounded test from (subject, topics, difficulty, count) via a streamed multi-stage pipeline. | `[IMPLEMENTED]` | `practice-generation-pipeline.ts`, `generate-stream` route | core |
| STU-R2 | Preflight quota before generation; consume 1 test credit on persist; **fail-closed** on billing infra error; refund credit if persistence fails. | `[IMPLEMENTED]` | `entitlements.ts` (`preflightPracticeTestQuota`, `consumeTest`, `refundTest`) | core |
| STU-R3 | Ground questions in curriculum chunks (RAG). | `[IMPLEMENTED]` | `generation-evidence-pack.ts`, `topic_context_chunks` | core |
| STU-R4 | Near-duplicate / topic-concentration / visual / chunk-alignment quality gates. | `[IMPLEMENTED]` | `practice-generation-quality-gates.ts`, pgvector `questions.embedding` | core |
| STU-R5 | Independent answer-key verification (second model re-solves, checks stated key). | `[GAP]` | — | core (quality) |
| STU-R6 | Timed session with autosave, question flagging, tab-blur/focus + device/IP integrity capture, auto-submit on expiry. | `[IMPLEMENTED]` | `practice-test-session/`, `batch-upsert-answers`, `tab-blur`, `session-meta`, `auto-submit-expired` | §4.28 |
| STU-R7 | Operator pause freezes the student timer; admin time extensions honoured. | `[IMPLEMENTED]` | `tests.isPaused/adminExtensions/accumulatedPauseSeconds`; realtime poll | §4.28 |
| STU-R8 | Auto-grade: per-answer correctness, score, model-answer + user-answer summaries, feedback; report with strengths/weak-areas/recommendations; PDF export. | `[IMPLEMENTED]` | `ai-grade-practice-test.tsx`, `grading-*.ts`, `test_reports`, React-PDF docs | core |
| STU-R9 | Graceful grading-failure UX + admin regrade path. | `[IMPLEMENTED]` | `test_reports.gradingFailedAt`, `grading-error-ui.ts`, `/api/admin/tests/[id]/regrade` | §4.28 |
| STU-R10 | AI tutor with `explain` / `solve_with_me` / `quiz_me` modes, on-syllabus scope, deterministic safety screen, image/PDF attachments with OCR, KaTeX+Markdown. | `[IMPLEMENTED]` | `src/lib/doubt/**`, `doubt-tutor-mode.ts`, `safety.ts`, `tesseract.js` | §4.27 |
| STU-R11 | Doubt-chat gated by token quota; output tokens metered post-turn. | `[IMPLEMENTED]` | `canStartDoubtChat`, `consumeTokens` | core |
| STU-R12 | Per-topic mastery tracking (status, average, confidence, trend) recomputed after each graded test. | `[IMPLEMENTED]` | `performance_tracker`, `topic-rollup.ts` | core |
| STU-R13 | Assignment tests appear with due dates, materialise on open, results flow back to the teacher. | `[IMPLEMENTED]` | `assignment_submissions`, `practice_jobs` (`assign_generate_test`), `open-indicator` | core |
| STU-R14 | In-app notifications + email for report-ready, usage thresholds (80/100%), trial reminders, assignment events. | `[IMPLEMENTED]` | `src/lib/notifications/**`, `usage_notification_log` | core |
| STU-R15 | Weekly activity streaks + rewards + leaderboard. | `[IMPLEMENTED]` | `student_activity_streaks`, `activity-streak-widget.tsx` | core |
| STU-R16 | Origin/CSRF gate on mutating `/api/student/*`; per-user rate limits on all student API routes (reads **and** practice mutations incl. `flag-question`). | `[IMPLEMENTED]` | `studentProxyGate` (`src/lib/student/proxy-guard.ts`) gates POST/PUT/PATCH/DELETE via `originAllowed`; `consumeStudentRateLimit` (`src/lib/student/rate-limit.ts`, fail-closed in prod) on notifications (route, read-all, `[id]`, unread-count), activity-streak, assignments/open-indicator, batch-upsert-answers, flag-question, tab-blur, session-meta, abandon-submit | core (security) |
| STU-R17 | Screen-reader descriptions for practice visuals; wizard focus management. | `[GAP]` | `visuals/renderers/` | core (a11y) |
| STU-R18 | Closed learning loop: SM-2-lite per-topic review schedule advanced on every graded test; nightly scheduler materialises a `review` test for the most-due weak topic under quota/sub-budget/daily caps; student notified with a deep link. | `[IMPLEMENTED]` *(dormant: rollout cohort defaults to nobody — see §7)* | `review-schedule.ts`, `review-schedule-payload.ts`, `/api/internal/practice/review-scheduler`, `review-selection.ts`, `review-cohort.ts`, `review-generation.ts`, migrations `20260704000000`–`20260704030000` | core (loop) |
| STU-R19 | Mistake-grounded doubt chat: "Ask about this" on a graded wrong answer opens a tutor conversation pre-grounded in the question, the student's answer, the reference answer, and grader feedback — ownership-checked, persisted across turns. | `[IMPLEMENTED]` | `src/lib/doubt/mistake-context.ts`, `doubt-actions.ts` (`mistakeContext`), `doubt_conversations.metadata.mistakeBlock`, `qna-log-detail-dialog.tsx` | core (loop) |
| STU-R20 | Guided first-run onboarding: welcome dialog (durable cross-device via `profiles.onboarding_welcome_seen_at`), coach-mark tour with top-bar replay, dismissible dashboard checklist; mobile + inert-overlay a11y handled. | `[IMPLEMENTED]` | `src/components/onboarding/**`, `onboarding-checklist.tsx`, `src/lib/onboarding/welcome-actions.ts`, migration `20260704040000` | core (ux) |
| STU-R21 | Streak freeze & recovery: one missed week is bridged by a freeze, re-earned after ≥4 active weeks; frozen weeks count toward rewards; kill-switch `streak_freeze_enabled()`. | `[IMPLEMENTED]` | `student_activity_streaks.bridged_weeks/freezes_available/freeze_last_used_week`, `refresh_student_activity_streak`, `activity-streak-widget.tsx`, migration `20260531195123` | core |
| STU-R22 | Durable, idempotent student-initiated generation: enqueue + poll instead of streaming; survives function timeout/disconnect/reclaim without double-charge (keyed on `tests.client_request_id`). | `[PARTIAL]` *(built end-to-end; off in prod behind `PRACTICE_ASYNC_GENERATE` / `NEXT_PUBLIC_PRACTICE_ASYNC_GENERATE`)* | `app/api/student/practice/generate{,/status}`, `student-generation.ts`, `practice_generate_self_test`, migrations `20260705000300/0400` | core (reliability) |
| STU-R23 | Manual (teacher-authored) assignments are takeable like any other test: templates copied (no LLM) into `questions` on open; grading/reports/PDF reused; MCQ options A–F scored. | `[IMPLEMENTED]` | `assignment_questions`, `practice_create_manual_assigned_test`, `src/lib/assignments/manual-*.ts`, migration `20260705000600` | core |
| STU-R24 | Honest in-flight progress for generation and grading: monotonic 5-bucket checklists with "Drafted/Graded N of M" counts. | `[IMPLEMENTED]` | `generation-progress-buckets.ts`, `grading-progress-buckets.ts`, NDJSON envelope (`generate-stream-envelope.ts`), `practice_jobs.payload` grading counts | core (ux) |
| STU-R25 | App-level rate limiting on student auth actions (login/signup/password-reset), account-first keyed, fail-closed in prod. | `[IMPLEMENTED]` | `src/lib/auth/rate-limit.ts` wired into `app/(auth)/login/actions.ts` + signup/forgot-password actions | core (security) |

### 8.3 Data contracts & invariants (enforced)
- **Answer idempotency:** one row per `(test_id, question_id)` — `student_answers_test_question_uidx`. Autosave is an upsert.
- **Question identity:** unique `(test_id, question_number)` — `questions_test_question_number_uidx`.
- **Ownership:** every practice mutation must re-verify `tests.studentId == session user` (`src/lib/practice/test-ownership.ts`); never trust a `testId` from the body alone.
- **One assignment test per submission:** `idx_tests_assignment_submission_uq` (partial unique on `assignment_submission_id`).
- **Async-generation idempotency:** one test per `(student_id, client_request_id)` (`uq_tests_student_client_request_id`) and one active `student_generate_test` job per key (partial unique on `payload->>'client_request_id'`); a retried enqueue or a reclaimed worker resolves to the existing test instead of regenerating/recharging.
- **Review-job dedup:** one active `review_generate` per `(student_id, payload->>'topic_id')` (`practice_jobs_review_generate_active_uq`); the scheduler additionally enforces ≤1 review/student/day and an 8-per-period sub-budget before insert.
- **Review schedule atomicity:** schedule fields ride the same `practice_update_trackers_bulk` jsonb items as the mastery rollup (written only when `consecutive_good` is present, so replay/admin callers leave the schedule intact; JSON null clears = graduation).
- **Mistake grounding ownership:** `loadMistakeForQuestion` only grounds when the question's test belongs to the requesting student **and** the answer is incorrect.
- **Quota safety:** billing RPC failures are **fail-closed** (no free test); a consumed credit is refunded if the test fails to persist. Doubt-chat token pre-debit happens only after conversation-ownership verification.
- **Answer key:** `questions.answer_key` is authoritative jsonb; grading compares `student_answers.studentAnswer` against it. Manual-assignment MCQs may use options A–F (AI tests use A–D); the deterministic fallback scorer normalizes the full range.
- **Rich-answer hygiene:** every student answer passes the server-side sanitizer (`rich-answer-sanitize-server.ts`) at the single write choke point (`student-answer-write.ts`), sharing the TipTap editor allowlist.

### 8.4 Telemetry & observability
- `practice_generation_runs` / `_steps` — per-run tokens, latency, per-stage status (`generation-telemetry.ts`). `request_mode` CHECK now admits `assignment_worker` / `review_worker` (migration `20260705000500` — previously those inserts failed silently, so worker-generated tests produced no run telemetry); `correlation_id` links async-generation runs to their `client_request_id`.
- `practice_analytics_events` — funnel/usage events, including per-topic `review_test_completed` with `before_score`/`after_score`/`delta` (the loop's before/after effectiveness measure).
- `ai_calls` — per-AI-call cost/tokens/model.
- In-flight grading progress (`graded`/`total`) on `practice_jobs.payload` — best-effort, student-facing only.
- Sentry spans/breadcrumbs (coverage on practice actions is `[PARTIAL]`); Sentry `beforeSendLog` scrubs PII on all three runtimes.

### 8.5 Known gaps & next-step hooks (ordered by leverage)
1. **STU-R5 Answer-key verifier** `[GAP]` — **Hook:** add a verification stage in `practice-generation-pipeline.ts` between quality gates (`practice-generation-quality-gates.ts`) and validation (`practice-validation.ts`); reuse `model-router.ts` for an independent solve; route low-confidence items to `practice-generation-replacement.ts`.
2. **Distractor-quality judge** `[GAP]` — **Hook:** new gate in `practice-generation-quality-gates.ts` operating on `questions.options`.
3. **VLM judge for diagrams** `[GAP]` — visual gates are lexical today (`visuals/`); **Hook:** add a vision pass keyed off the visual spec before persist.
4. **Self-consistency / N-of-3 ensemble** `[GAP]` for ambiguity detection.
5. **Reading-level (Flesch-Kincaid) gate** `[GAP]`.
6. **STU-R18 review-loop go-live** `[IMPLEMENTED, dormant]` — **Hook:** no code change; widen the cohort via `CREATE OR REPLACE` of `review_scheduler_rollout_pct()` (e.g. 10 → 50 → 100) and/or seed `review_scheduler_cohort_org_ids()` with pilot orgs, on BOTH Supabase projects; watch `review_test_completed` deltas before widening.
7. **STU-R22 async-generation rollout** `[PARTIAL]` — **Hook:** set `PRACTICE_ASYNC_GENERATE=true` + `NEXT_PUBLIC_PRACTICE_ASYNC_GENERATE=true` in prod once the polling UX has soaked; then consider retiring the streaming tail-guard.
8. **STU-R17 Visual a11y** `[GAP]` — **Hook:** add `ariaDescription` to each renderer in `visuals/renderers/`; focus-move + `aria-live` in `practice-test-wizard.tsx`.
9. **Golden-set CI regression harness** `[GAP]` — no automated quality regression on generation today.
10. **STU-R19 surface expansion** `[PARTIAL-by-design]` — **Hook:** add the "Ask about this" entry to the graded report view (`student-reports-view.tsx`) alongside the existing QnA-log dialog entry; reuse `createDoubtConversation({ mistakeContext })`.
