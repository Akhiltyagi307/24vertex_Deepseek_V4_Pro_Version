# 24Vertex — Student Portal

**Snapshot:** 2026-05-31 · branch `claude/festive-goldberg-e79b4b` @ `8f69969`. The §8 status tags were re-verified against current code on this date (superseding the older `docs/audit/*` snapshot of 2026-05-17).
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
- **Do work their teacher assigned** and have it count.
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
- Login is a server action (`app/(auth)/login/actions.ts`) that signs in, reads the profile, and `redirect()`s by role.
- The portal is guarded by `app/student/layout.tsx` via `requireVerifiedStudent()` (`src/lib/auth/require-verified-student.ts`), part of the shared `requireUser({ role })` helper family (`src/lib/auth/require-user.ts`). It asserts authenticated + `role === 'student'` + not suspended/soft-deleted. The shell (`src/components/student/student-shell.tsx`, `student-app-sidebar.tsx`, `student-top-bar.tsx`) renders the nav.
- A global signed-out listener (`src/components/auth/auth-signed-out-listener.tsx`) broadcasts logout across tabs.
- Middleware `proxy.ts` handles maintenance routing and origin checks (see §3.7).

### 3.3 Data model — tables this portal reads/writes
*(Drizzle definitions in `src/db/schema/`.)*

| Table | Role in the student portal |
|---|---|
| `profiles` | The student record: `fullName`, `role`, `grade`, `section`, `stream`, `electiveSubjectId`, `schoolName`, `parentEmail`, `studentLinkCode` (8-char code parents use to link), `organizationId`, `isSuspended`, `deletedAt`. |
| `subjects` / `topics` | Curriculum tree: subject (per grade/stream/elective) → unit → chapter → topic, with `learningObjectives`. Drives what a student can practice. |
| `tests` | One practice test attempt: `studentId`, `subjectId`, `testType` (`self`/assignment), `status` (`in_progress`/`completed`/…), `timeLimitSeconds`, `totalScore`, integrity fields (`tabBlurCount`, `deviceFingerprint`, `lastIp`, `isPaused`, `adminExtensions`, `accumulatedPauseSeconds`). |
| `questions` | Generated questions: `questionText`, `questionType`, `answerKey` (jsonb), `options`, `metadata` (visuals etc.), `embedding` (pgvector 1536 for dedup). |
| `student_answers` | Per-question response: `studentAnswer` (jsonb), `isCorrect`, `scoreEarned`, `aiFeedback`, `aiUserAnswerSummary`, `aiReferenceAnswerSummary`, `timeSpentMs`, `visits`, `flaggedForReview`. |
| `test_reports` | Graded report: `summaryReport` (jsonb), `strengths[]`, `improvementAreas[]`, `aiInsights`, `topicPerformance`, `recommendations[]`, `pdfStoragePath`. |
| `question_flags` | Student "this question looks wrong" reports. |
| `performance_tracker` | Per-(student, topic) mastery: `status`, `averageScore`, `testsTaken`, `confidenceScore`, `trend`. The analytics backbone. |
| `practice_jobs` | Async queue for generation/grading work (esp. assignment-materialised tests). |
| `practice_generation_runs` / `practice_generation_steps` | Telemetry per generation: tokens, latency, per-stage status. |
| `practice_analytics_events` | Funnel/usage events for the practice flow. |
| `doubt_conversations` / `doubt_messages` / `doubt_message_attachments` | AI tutor threads, messages (with `tutorMode`), and uploaded images/PDFs (with `ocrText`). |
| `student_activity_streaks` | Weekly streak counters + reward grant tracking. |
| `subscriptions` / `usage_periods` / `quota_grants` | Plan + per-period test/token quotas the portal consumes against. |
| `notifications` (via `src/lib/notifications/**`) | In-app notifications (report ready, assignment, usage threshold, trial reminders). |

### 3.4 Routes (pages)
All under `app/student/`:
`dashboard`, `practice` (+ `practice/[testId]` for the live session/report, `practice/actions/`), `doubt-chat`, `assignments`, `performance`, `reports` (+ `reports/[subjectId]`), `qna-logs`, `notifications`, `settings` (+ `settings/sections/`), `subscription`, `ai`.

### 3.5 Server actions & API routes
- **Practice API** (`app/api/student/practice/`): `generate-stream` (SSE generation), `batch-upsert-answers`, `flag-question`, `session-meta`, `tab-blur`, `abandon-submit`.
- **Practice actions** (`app/student/practice/actions/`, `session-actions.ts`): create/configure, finalize/submit, abandon. Ownership is re-checked against `tests.studentId` (`src/lib/practice/test-ownership.ts`).
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
- **Streaming:** SSE envelope (`generate-stream-envelope.ts`) feeds the wizard incrementally.
- **Telemetry:** `generation-telemetry.ts` → `practice_generation_runs` / `_steps`.
- **Visuals:** spec-driven renderers in `src/components/student/practice/visuals/renderers/` (geometry, statistics charts via Plotly, physics, chemistry via SMILES); exemplars in `src/lib/practice/visuals/`.

**Grading pipeline:** `src/lib/practice/ai-grade-practice-test.tsx` + `grading-*.ts` (prompts, schema, normalize, feedback format). On submit, each answer is scored, model/user answer summaries written to `student_answers`, a `test_reports` row produced, `performance_tracker` updated (`topic-rollup.ts`), and a "report ready" notification + email fired.

### 3.7 Cross-cutting services
- **Billing gates:** `consumeTest` (decrement test quota, **fail-closed** on infra error; refundable via `refundTest` if persistence fails) and `canStartDoubtChat` / `consumeTokens` (output-token quota). Controlled by `SAAS_ENFORCEMENT`; `staffOverride` bypasses.
- **Notifications:** `src/lib/notifications/**` writes in-app rows + Resend emails (report-ready, usage-threshold 80/100%, trial reminders, assignment events).
- **Security:** rate limiting (`src/lib/ratelimit`), CSP (`src/lib/security/csp.ts`), origin guard (`src/lib/security/origin-guard.ts`), moderation, attachment MIME/size limits.
- **Realtime:** test row polling/realtime (`use-test-row-realtime-poll.ts`) so admin pauses/extensions and async grading reflect live.

---

## 4. Capabilities, feature by feature

Each capability below has a **[Plain]** "what the student does" line and a **[Technical]** "how it works" line.

### 4.1 Generate a practice test
- **[Plain]** The student picks a subject and chapter/topic(s), chooses how hard and how many questions, and the app writes a brand-new test for them in seconds — with diagrams, graphs, and proper math where needed. No two tests are identical.
- **[Technical]** `practice-test-wizard.tsx` posts config → `generate-stream` SSE route → `practice-generation-pipeline.ts` runs the staged pipeline (§3.6), streaming progress. Questions persisted to `questions` (with `answer_key`, `options`, `embedding`); the `tests` row opens in `in_progress`. Quota preflighted, then `consumeTest` on persist.

### 4.2 Take a test (exam-like session)
- **[Plain]** A clean test screen with a countdown timer. Answers save automatically as they go, they can flag confusing questions, jump between questions, and submit when done (or it auto-submits when time runs out).
- **[Technical]** Session UI in `src/components/student/practice/practice-test-session/`. Autosave via `batch-upsert-answers`; `session-meta` + `tab-blur` track focus loss (`tabBlurCount`) and device/IP for integrity; `abandon-submit` and the internal `auto-submit-expired` cron close stale sessions. Timer honours `timeLimitSeconds`, operator `isPaused`, and `adminExtensions`. Live state via realtime poll.

### 4.3 Automatic AI grading + graded report
- **[Plain]** Right after submitting, the student gets a score, sees which answers were right or wrong, reads the correct/model answer, and gets specific feedback on what to fix — plus strengths, weak areas, and study recommendations. Downloadable as a PDF.
- **[Technical]** Grading pipeline (§3.6) writes `student_answers.scoreEarned/aiFeedback/...` and a `test_reports` row (`strengths[]`, `improvementAreas[]`, `recommendations[]`, `topicPerformance`). Report UI `student-reports-view.tsx`; PDF via `@react-pdf/renderer` (`practice-grading-pdf-document.tsx`, `-visual.tsx`) served through a signed URL. `performance_tracker` updated atomically.

### 4.4 Ask a doubt (AI tutor)
- **[Plain]** A chat with an AI tutor scoped to their syllabus. Three styles: **Explain** (teach me this), **Solve with me** (walk through step-by-step), and **Quiz me** (test me with questions). They can upload a photo of a worksheet or a PDF and ask about it. Math and diagrams render properly.
- **[Technical]** `doubt-chat` UI streams via `app/api/student/doubt-chat` + `@ai-sdk/react`. Modes `explain | solve_with_me | quiz_me` (`doubt-tutor-mode.ts`). Subject packs (`docs/doubt-subject-packs/*.md`, 12 subjects) + shared preamble shape the system prompt; `safety.ts`/`safety-detectors.ts` run a deterministic safety screen; `scope-precheck.ts`/`validate-doubt-scope.ts` keep it on-syllabus. Attachments → Storage `doubt-attachments`, OCR via `tesseract.js` populates `ocrText`. Persisted to `doubt_conversations`/`doubt_messages`. Gated by `canStartDoubtChat`; output tokens metered via `consumeTokens`.

### 4.5 Performance analytics
- **[Plain]** A dashboard showing how the student is doing per subject and per topic — what they've mastered, what's shaky, and whether they're trending up or down — so they know exactly what to revise next.
- **[Technical]** `student-performance-view.tsx` reads `performance_tracker` (per-topic `status`, `averageScore`, `confidenceScore`, `trend`) rolled up by subject. Charts via Recharts. Mastery recomputed after each graded test (`topic-rollup.ts`).

### 4.6 Reports & QnA logs
- **[Plain]** A history of every test taken (per subject) and a searchable log of every question they answered with the feedback they got — a personal revision archive.
- **[Technical]** `reports`/`reports/[subjectId]` over `tests` + `test_reports`; `qna-logs` paginates `student_answers` joined to `questions` with prev/next nav (`qna-logs/nav`).

### 4.7 Assignments from teachers
- **[Plain]** Tests a teacher set appear here with due dates. The student opens one, takes it like any other test, and the result flows back to the teacher.
- **[Technical]** `assignments` page reads `assignment_submissions` (joined to `assignments`). Opening triggers materialisation of a `tests` row via a `practice_jobs` `assign_generate_test` job; on submit the submission's `score`/`lifecycleStatus`/`isLate`/`penaltyApplied` update. `open-indicator` surfaces unstarted work.

### 4.8 Notifications
- **[Plain]** A bell with updates: "your report is ready", "new assignment", "you're near your monthly limit", trial reminders.
- **[Technical]** `notifications` + API (`unread-count`, `read-all`, `[id]`). Rows written by `src/lib/notifications/**`; some mirrored to email via Resend.

### 4.9 Activity streak & leaderboard
- **[Plain]** Practising in a week keeps a streak alive; longer streaks earn rewards, and a leaderboard adds friendly competition — gentle nudges to keep studying.
- **[Technical]** `student_activity_streaks` (`streakWeeks`, `currentWeekActive`, `longestStreakWeeks`, `rewardGrantedAt`); widgets `activity-streak-widget.tsx`, `student-dashboard-leaderboard-card.tsx`; updated via `app/api/student/activity-streak`. Rewards can mint `quota_grants`.

### 4.10 Settings & subscription
- **[Plain]** Edit profile (name, grade, school, avatar), choose which notifications to receive, change password, and manage the plan — see how many tests/AI credits are left this period and upgrade if needed.
- **[Technical]** `settings/sections/` + action files (profile, account-security, notification-preferences). `subscription` reads `getCachedEntitlements()` (plan, `testsLeft`, `tokensLeft`, trial days, status). Checkout via Razorpay; account-security uses the role-agnostic `src/lib/auth/account-security-actions.ts`.

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
- CSRF/origin gating now covers mutating `/api/student/*` routes (`studentProxyGate`), and notification/streak/assignment reads are rate-limited. Remaining: explicit rate limits on `flag-question`/practice mutations are optional hardening (the 2026-05-17 audit's "no CSRF gate" finding is resolved).
- Heavy client components and chart libs (Recharts/Plotly) affect first-load performance on some pages.
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
- Grade step writes `student_answers.*`, a `test_reports` row, and rolls up `performance_tracker` (`topic-rollup.ts`).
- Integrity counters accrue during `in_progress`: `tabBlurCount` (`/api/student/practice/tab-blur`), `deviceFingerprint`, `lastIp`.

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
processor: /api/internal/practice/run-jobs
```

**Entitlement gate — `subscriptions.status`** (derived: `src/lib/billing/entitlements.ts`)
```
trialing | active | coupon | grace        → access allowed while quota remains
past_due | cancelled | expired            → canStartTest=false, canChatDoubt=false
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
| STU-R16 | Origin/CSRF gate on mutating `/api/student/*`; rate limits on high-volume reads. | `[IMPLEMENTED]` | `studentProxyGate` (`src/lib/student/proxy-guard.ts`) gates POST/PUT/PATCH/DELETE via `originAllowed`; `applyRateLimit` on notifications (route, read-all, `[id]`, unread-count), activity-streak, assignments/open-indicator | core (security) |
| STU-R17 | Screen-reader descriptions for practice visuals; wizard focus management. | `[GAP]` | `visuals/renderers/` | core (a11y) |

### 8.3 Data contracts & invariants (enforced)
- **Answer idempotency:** one row per `(test_id, question_id)` — `student_answers_test_question_uidx`. Autosave is an upsert.
- **Question identity:** unique `(test_id, question_number)` — `questions_test_question_number_uidx`.
- **Ownership:** every practice mutation must re-verify `tests.studentId == session user` (`src/lib/practice/test-ownership.ts`); never trust a `testId` from the body alone.
- **One assignment test per submission:** `idx_tests_assignment_submission_uq` (partial unique on `assignment_submission_id`).
- **Quota safety:** billing RPC failures are **fail-closed** (no free test); a consumed credit is refunded if the test fails to persist.
- **Answer key:** `questions.answer_key` is authoritative jsonb; grading compares `student_answers.studentAnswer` against it.

### 8.4 Telemetry & observability
- `practice_generation_runs` / `_steps` — per-run tokens, latency, per-stage status (`generation-telemetry.ts`).
- `practice_analytics_events` — funnel/usage events.
- `ai_calls` — per-AI-call cost/tokens/model.
- Sentry spans/breadcrumbs (coverage on practice actions is `[PARTIAL]`).

### 8.5 Known gaps & next-step hooks (ordered by leverage)
1. **STU-R5 Answer-key verifier** `[GAP]` — **Hook:** add a verification stage in `practice-generation-pipeline.ts` between quality gates (`practice-generation-quality-gates.ts`) and validation (`practice-validation.ts`); reuse `model-router.ts` for an independent solve; route low-confidence items to `practice-generation-replacement.ts`.
2. **Distractor-quality judge** `[GAP]` — **Hook:** new gate in `practice-generation-quality-gates.ts` operating on `questions.options`.
3. **VLM judge for diagrams** `[GAP]` — visual gates are lexical today (`visuals/`); **Hook:** add a vision pass keyed off the visual spec before persist.
4. **Self-consistency / N-of-3 ensemble** `[GAP]` for ambiguity detection.
5. **Reading-level (Flesch-Kincaid) gate** `[GAP]`.
6. **STU-R16 CSRF + rate limits** `[IMPLEMENTED]` — `studentProxyGate` + per-route `applyRateLimit` are in place. Remaining optional hardening: explicit rate limits on `flag-question` and practice mutation routes (today bounded by the session/billing model rather than a counter).
7. **STU-R17 Visual a11y** `[GAP]` — **Hook:** add `ariaDescription` to each renderer in `visuals/renderers/`; focus-move + `aria-live` in `practice-test-wizard.tsx`.
8. **Golden-set CI regression harness** `[GAP]` — no automated quality regression on generation today.
