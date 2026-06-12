# 24Vertex — Teacher Portal

**Snapshot:** 2026-06-12 · branch `main` @ `27d7fbb`. The §8 status tags were re-verified against current code on this date (superseding the 2026-05-31 snapshot `8f69969`).
**Product:** 24Vertex (technical slug `vertex24`; legacy `eduai`)
**Audience for this doc:** mixed. **[Plain]** sections are for any human reader (teachers, school leaders, parents, business). **[Technical]** sections are dense and name concrete files, tables, routes, and flows for engineers and LLMs.
**Scope:** `app/teacher/**`, `app/api/teacher/**`, `src/lib/teachers/**`, `src/lib/assignments/**`, `src/lib/auth/require-verified-teacher.ts`, and the admin-side approval surface in `src/lib/admin/teacher-approval*.ts`.

---

## 1. What the Teacher Portal is — [Plain]

The Teacher Portal lets an educator use 24Vertex's AI engine with a real class. A verified teacher can:

- **Assign AI-generated practice tests** to their students with a due date.
- **Write their own assignments by hand** — five question types with options, answer keys, and marking points — when they want full control instead of AI generation.
- **See a roster** of the students linked to them.
- **Review submissions and results** once students complete the work.
- **Read class-wide and per-student analytics** — which students and which topics need attention.
- **Get an AI "class insight"** — a short narrative read on how the class is doing — and turn an at-risk student flag into a ready-made remedial assignment in one click.
- **Manage their own profile and notification settings.**

The teacher never has to mark anything by hand and doesn't have to write questions unless they want to. They decide *what* to assign and *to whom*; the platform generates (or accepts their hand-written questions), delivers, and grades it, then hands back the insights.

---

## 2. How the Teacher Portal fits the wider platform — [Plain]

- A teacher usually belongs to an **organization** (a school or coaching institute) by entering a code the admin gave them; an **independent teacher** (no organization) can instead link individual students by code.
- Teachers must be **approved by an admin** before they get access — a trust gate so random sign-ups can't reach students' data.
- Teachers connect to **students** (a roster) and push **assignments** to them.
- Students complete the assigned work in the **Student Portal**; results and mastery data flow back to the teacher.
- **Parents** and **admins** see overlapping slices of the same student data.

So the teacher sits between the admin (who grants access and supplies curriculum) and the student (who does the work), turning the AI engine into a classroom tool.

---

## 3. Current technical setup — [Technical]

### 3.1 Stack and where it lives
Same platform foundation as the rest of 24Vertex: Next.js 16 App Router (React 19, Server Components/Actions), Supabase Postgres + Auth, Drizzle ORM, Tailwind v4 + shadcn/Radix, Recharts, Vercel, Sentry, Upstash rate limiting. Teacher code lives under `app/teacher/**` and `src/components/teacher/**`.

### 3.2 Onboarding, verification, and access control
- **Sign-up:** teacher signs up via Supabase Auth (`app/(auth)/signup/teacher/`), supplying org + the org `linkingCode`. Creates a `profiles` row with `role = 'teacher'`, `isVerified = false`, sends a pending-approval email (`sendTeacherPendingApprovalEmail`), and checks the 24h re-signup cooldown (`hasRecentTeacherRejection`). The signup action is IP-rate-limited via `consumeAuthSignup` (`src/lib/auth/rate-limit.ts`, fail-closed in prod).
- **Pending gate:** `app/teacher/pending` is shown until an admin approves. The page is a server component that redirects to `/teacher/dashboard` once `is_verified` flips; a client island (`pending-status.tsx`) calls `router.refresh()` every 20s so the teacher moves forward without reloading. The protected area lives under the `app/teacher/(protected)/` route group with its own `layout.tsx`.
- **Verification helper (in use):** `app/teacher/(protected)/layout.tsx` calls `requireVerifiedTeacher()` (`src/lib/auth/require-verified-teacher-layout.ts`), wrapping `getVerifiedTeacherSession()` (`require-verified-teacher.ts`). Asserts authenticated + `role='teacher'` + `isVerified=true`, and redirects on `suspended` → `/login?suspended=1`, `not_verified` → `/teacher/pending`, `not_signed_in` → `/login`. Also reachable via the shared `requireUser({ role:'teacher' })` (`require-user.ts`).
- **Admin approval flow:** `app/api/admin/teachers/**` (`pending`, `[id]/approve`, `/reject`, `/request-info`) drives the state machine. Approve flips `is_verified` via the `admin_set_teacher_verified` RPC (`src/lib/admin/teacher-approval.ts`), appends a `'verified'` `teacher_approval_history` row, sends a Resend approval email, inserts an in-app welcome notification, and writes a strict `admin_action_log` row. Reject flips `is_verified=false` + writes `admin_action_log`, but does **not** yet write a `'rejected'` history row — see TCH-R14.
- **RPC hardening (migration `20260706000000`):** `admin_set_teacher_verified` now carries an in-function authz guard (rejects any real authenticated non-`service_role` caller; the legitimate Drizzle path has `auth.uid() IS NULL`) and remains `GRANT EXECUTE ... TO postgres` only — defense-in-depth around the only write path for teacher verification.
- **States:** `pending` → `approved (is_verified=true)` / `rejected` / `needs-info`.

### 3.3 Data model — tables this portal reads/writes
*(Drizzle definitions in `src/db/schema/`.)*

| Table | Role in the teacher portal |
|---|---|
| `profiles` | Teacher record (`role='teacher'`, `isVerified`, `organizationId`, `subjectsTaught[]`, `teacherRosterGrade`, `teacherRosterSubjectId`, `phone`, `bio`, `website`, `avatarUrl`). Also the student rows the teacher can see. |
| `organizations` | School/institute the teacher belongs to (`type`, `name`, `linkingCode`). |
| `teacher_organization_memberships` | Teacher↔org membership (`status`; **one active membership per teacher** enforced by a partial unique index). |
| `teacher_student_links` | Teacher↔student relationship (`status` `pending`/`active`, `linkedAt`, `revokedAt`). |
| `teacher_approval_history` | Audit of pending→verified→rejected transitions. |
| `assignments` | A teacher-created assignment: `teacherId`, `organizationId`, `assignmentKind` (default `practice_test`), `title`, `instructions`, `config` (jsonb: subject/topics/grade/difficulty/question mix + `authoring_mode` `'ai'` (default) / `'manual'`), `dueAt`, `status` (`draft`/`published`), `publishedAt`. |
| `assignment_submissions` | Per-student row for an assignment (`studentId`, `testId`, `lifecycleStatus`, `score`, `submittedAt`, `gradedAt`, `isLate`, `penaltyApplied`). Unique per (assignment, student). |
| `assignment_questions` | The authored question template for a **manual** assignment (one set per assignment, copied per student at materialization): `questionNumber`, `topicId`, `questionType` (5 types), `questionText`, `options`, `answerKey`, `difficultyLevel`. Unique (assignment, question_number); teacher-read RLS, server-side writes only. Migration `20260705000600_manual_assignment_authoring.sql`. |
| `teacher_class_insights` | Per-teacher cache of AI dashboard class-insight narratives, keyed (teacher, grade, section, subject, prompt_version) with `NULLS NOT DISTINCT` (NULL scope = "all") and validated by a `data_fingerprint` (sha256 of the summary inputs). `served_count`/`last_served_at` for hit-rate + the weekly prune cron. Service-role only (no RLS policies on purpose). Migrations `20260630000000` + `20260701000000` + `20260701000100`. |
| `tests`, `questions`, `student_answers`, `test_reports` | The actual generated test + answers + graded report a teacher reviews (read access scoped to their students). `tests.test_type='review'` rows feed the auto-retest summary. |
| `performance_tracker` | Per-(student, topic) mastery the teacher aggregates for class/topic analytics. |
| `practice_jobs` | Async queue that materialises an **AI** assignment into a per-student `tests` row (`assign_generate_test`). Manual assignments materialise without the LLM via the `practice_create_manual_assigned_test` RPC instead. |

### 3.4 Routes (pages)
- `app/teacher/pending` — pre-approval holding page (self-refreshing, auto-redirects on approval).
- `app/teacher/(protected)/dashboard` — class overview + at-risk/performance bands + AI class-insight card + at-risk intervention dialog.
- `app/teacher/(protected)/assignments` — create/manage assignments; `assignment-create-switcher.tsx` tabs between "AI-generated" and "Write my own" (manual builder + saved manual drafts).
- `app/teacher/(protected)/assignments/[id]/edit` — manual-assignment editor (continue a draft, or edit a published manual assignment).
- `app/teacher/(protected)/students` — "Link Student" by six-character code, **independent (org-less) teachers only**; org teachers are `redirect()`ed to `/teacher/student-performance`.
- `app/teacher/(protected)/submissions` — submitted work + results (manual assignments badged by `authoringMode`).
- `app/teacher/(protected)/student-performance` (+ `[studentId]`) — per-student drilldown + read-only auto-retests summary card.
- `app/teacher/(protected)/topic-performance` (+ `[topicId]`) — topic/chapter mastery across the cohort.
- `app/teacher/(protected)/settings` — profile, notifications, org roster.

### 3.5 Server actions & API routes
- **AI assignment lifecycle:** server actions (`assignments/actions.ts`) create/publish `assignments`; publishing validates scope (`validatePracticeAssignmentConfigForStudents`), fans out `assignment_submissions` per targeted student, notifies students (`notifyAssignmentPublished`), and enqueues `assign_generate_test` `practice_jobs`. Due dates must be in the future (`isAssignmentDueAtInPast`, `src/lib/assignments/assignment-due-at.ts`). Generation helpers: `src/lib/admin/assignment-generation.ts`, `assignments-admin.ts` (shared logic).
- **Manual assignment lifecycle:** `assignments/manual-actions.ts` — `saveManualAssignmentDraftAction`, `publishManualAssignmentAction`, `updatePublishedManualAssignmentAction`. Zod contracts in `src/lib/assignments/manual-schemas.ts` (max 50 questions, 5 min–4 h time limit, per-type answer-key schemas), queries in `manual-queries.ts`, config derivation in `manual-helpers.ts`. Publish re-checks roster access (`teacherFilterAccessibleStudentIdsForSession`) and scope; edits to a published manual assignment re-materialise only **not-yet-started** students (`appliedToNotStarted` / `skippedAlreadyStarted`).
- **Dashboard/analytics data:** `teacher-dashboard-data.ts` + `teacher-dashboard-actions.ts` (`fetchTeacherDashboardBundle`, `fetchTeacherAtRiskStudents`, `fetchTeacherClassPerformanceSummary`, `generateTeacherClassInsightAction`, `fetchCachedClassInsightAction`) aggregate performance, at-risk students, bands (`teacher-dashboard-performance-band-strip.tsx`), and the cached AI insight. `at-risk-intervention-actions.ts` plans + publishes a remedial assignment for one at-risk student.
- **Reports:** `app/api/teacher/reports/[testId]/pdf` (GET, the only published `/api/teacher/*` route) renders a student's graded report (same React-PDF document as the student portal), gated by `getVerifiedTeacherSession` + `teacherOwnsAssignmentTest`, rate-limited (`teacher-report-pdf-rate-limit.ts`) and audited (`teacher-report-pdf-audit-log.ts`).
- **Roster/settings:** `org-roster-actions.ts`, `account-actions.ts` — both resolve `organizationId`/`teacherId` from the session (`getActiveTeacherOrganizationSnapshot(session.user.id)`, updates keyed `.eq("id", user.id)`); request bodies carry filters only.
- **Cross-cutting:** mutating/data teacher server actions run inside `withTeacherActionTelemetry` (Sentry breadcrumbs) and consume `consumeTeacherPortalDataActionRateLimit` (`teacher-portal-action-rate-limit.ts`, 120 req / 60 s per teacher, fail-closed in prod when the limiter is degraded).

### 3.6 Relationship model — how teachers reach students
- **Org-scoped:** teacher and students share an `organizationId`; the roster grade/subject (`teacherRosterGrade`, `teacherRosterSubjectId`) narrows which students a teacher owns.
- **Explicit links:** `teacher_student_links` records the active teacher↔student edges. Code-based linking is now **independent-teacher-only**: the "Link Student" nav item is hidden for org teachers and `/teacher/students` redirects them to the student directory (the server-side RPC gate also blocks code linking for them).
- **Assignment targeting:** an assignment is owned by `teacherId` (+ `organizationId`); submissions are created for the targeted students.

### 3.7 Authoring vs. consumption
Teachers now have **two authoring modes**, switched on the assignments page:
- **AI-generated (default):** the teacher **configures** what the AI should generate (subject, topics, grade, difficulty, count) via the assignment `config`; the same multi-stage generation pipeline that powers student self-practice (see the Student Portal doc, §3.6) produces each student's distinct test.
- **Manual (`config.authoring_mode='manual'`):** the teacher hand-writes up to 50 questions (MCQ, fill-in-blank, numerical, short answer, long answer) with answer keys / marking points in `teacher-manual-assignment-builder.tsx`; the template is stored in `assignment_questions` and copied verbatim into each student's `tests` row by the `practice_create_manual_assigned_test` RPC — **no LLM call at materialization**.

Both modes are **graded by the same AI grading pipeline** (open-ended manual questions are graded against the teacher's marking points), so results, reports, and analytics stay consistent. What teachers still cannot do is hand-edit individual AI-generated items.

---

## 4. Capabilities, feature by feature

### 4.1 Get verified & join an organization
- **[Plain]** A teacher signs up, names their school/institute with the code the admin gave them, and waits for a quick approval. This keeps students safe from unverified strangers.
- **[Technical]** Supabase sign-up → `profiles(role='teacher', is_verified=false)` + `teacher_organization_memberships`. Held at `app/teacher/pending` until an admin flips `is_verified` via `app/api/admin/teachers/[id]/approve`; recorded in `teacher_approval_history`.

### 4.2 Build a roster of students
- **[Plain]** A teacher in a school sees the students they're responsible for, grouped by grade/section. A teacher working independently (no school on the platform) adds students one by one with a six-character link code.
- **[Technical]** Org teachers read students sharing their `organizationId` (filtered by roster grade/subject) via the settings roster tab and the student-performance directory; the `students` page ("Link Student", `teacher_student_links` with `status='active'`) is reserved for teachers **without** an active org membership — org teachers are redirected to `/teacher/student-performance`.

### 4.3 Create and publish assignments
- **[Plain]** The teacher creates an assignment — pick the subject and chapters, set difficulty and number of questions, add instructions and a due date — and publishes it to the class. Every student gets their own version of the test and a notification. Due dates can't be set in the past, and the grade picker starts on the teacher's own class.
- **[Technical]** Assignment server action writes an `assignments` row (`config` jsonb, `dueAt`, `status`). Publish → `status='published'`, fan-out `assignment_submissions` (unique per student) → enqueue `assign_generate_test` `practice_jobs` → `notifyAssignmentPublished`. Generation runs the standard pipeline so each student gets a distinct, curriculum-grounded test. `createAssignmentInputSchema` rejects past `due_at`; the manager defaults the grade to `teacherRosterGrade`, filters the student list by the picked grade, and uses a wheel time picker (`wheel-time-picker.tsx`) + `assignment-due-datetime-field.tsx` for the due instant.

### 4.4 Review submissions & results
- **[Plain]** As students finish, the teacher sees who submitted, who's late, the scores, and can open any student's full graded report with model answers and feedback.
- **[Technical]** `submissions` page reads `assignment_submissions` (status/score/`isLate`/`penaltyApplied`) joined to `tests`/`test_reports` (`teacher-submissions-hub.ts`); downloadable report via `app/api/teacher/reports/[testId]/pdf`, access-scoped to the teacher's students.

### 4.5 Per-student performance drilldown
- **[Plain]** For any student, the teacher sees strengths, weak topics, and whether they're improving — useful for parent meetings and targeted help.
- **[Technical]** `student-performance` reads `performance_tracker` for that student across subjects/topics; charts via Recharts. The directory page also carries the read-only auto-retests summary (§4.11).

### 4.6 Topic / cohort analytics
- **[Plain]** A class-wide view of which chapters most students are struggling with, so the teacher knows what to re-teach.
- **[Technical]** `topic-performance` aggregates `performance_tracker` across the roster; dashboard surfaces at-risk students and performance "bands" (red/amber/green).

### 4.7 Settings
- **[Plain]** Update profile (subjects taught, school, bio, photo), control notifications, and manage roster details.
- **[Technical]** `settings` sections + `*-actions.ts`. Mutations resolve the session's `organizationId`/`teacherId` server-side (verified: `org-roster-actions.ts`, `account-actions.ts`) — request payloads carry filters only.

### 4.8 Write-your-own (manual) assignments
- **[Plain]** Instead of letting the AI write the test, the teacher can write their own questions — multiple choice, fill-in-the-blank, numerical, short and long answer — with the correct answers and marking points. They can save a half-finished draft, publish to selected students, and even fix a question after publishing (students who already started keep the version they saw). The AI still does all the grading.
- **[Technical]** `assignment-create-switcher.tsx` ("AI-generated" / "Write my own") → `teacher-manual-assignment-builder.tsx` + `manual-question-editor.tsx` + `manual-topic-picker.tsx`. Actions in `assignments/manual-actions.ts`; template rows in `assignment_questions`; per-student copies created by `practice_create_manual_assigned_test` (SECURITY DEFINER, service-role-only RPC that re-validates published status, lifecycle, `teacher_can_access_student`, `authoring_mode='manual'`, and a 1–200 question bound). Edit page: `assignments/[id]/edit`. Post-publish edits re-materialise only `pending_materialize`/not-started students. E2e: `tests/e2e/teacher-manual-assignment.spec.ts`.

### 4.9 AI class insight (dashboard)
- **[Plain]** One click gives the teacher a short, plain-language read on the class — what's going well, who's slipping, what to re-teach — generated from real grades for exactly the grade/section/subject filter they're looking at. Repeat views are instant because the answer is remembered until the data changes.
- **[Technical]** `teacher-dashboard-insight-card.tsx` → `generateTeacherClassInsightAction` / `fetchCachedClassInsightAction` → `teacher-class-insight-service.ts`. Cache-first: `data_fingerprint` (sha256 of the scoped `TeacherClassPerformanceSummary`) keyed by (teacher, scope, `PROMPT_VERSION`) in `teacher_class_insights`; load/filter-change path is lookup-only (no token spend), an explicit Generate/Regenerate spends one LLM call and upserts. `hasEnoughDataForClassInsight` short-circuits empty scopes. Insights are per-teacher (own graded assignments fold into the summary) — deliberately no org pooling. Weekly pg_cron prune (90-day staleness).

### 4.10 At-risk intervention planner
- **[Plain]** Next to each at-risk student on the dashboard there's a "Plan" button: the AI writes a two-line diagnosis of why the student is struggling, proposes a remedial assignment (title, difficulty, focus topics from the student's weakest areas), and the teacher can publish it in one click.
- **[Technical]** `teacher-dashboard-at-risk-card.tsx` → `teacher-at-risk-intervention-dialog.tsx` → `at-risk-intervention-actions.ts` (`planAtRiskInterventionAction`, then a publish action that re-validates everything server-side and creates a normal AI practice assignment via `createPublishedPracticeAssignment`). Weak-topic inputs from `teacher-student-weak-topics-queries.ts` (access enforced in `getStudentInterventionTarget`); model picks topics by 1-based index with a weakest-topics fallback (`resolveFocusTopics`, `src/lib/teachers/teacher-at-risk-intervention.ts`).

### 4.11 Auto-retest (review loop) visibility
- **[Plain]** The platform automatically schedules short "retest" practice for topics students are forgetting (the closed learning loop). The teacher gets a read-only summary — how many retests were issued, completed, or are overdue across the class — so the loop is visible without being another thing to manage.
- **[Technical]** `review-summary-card.tsx` on `student-performance`, fed by `loadTeacherReviewSummary` (`src/lib/teachers/teacher-review-summary.ts`): counts `tests` rows with `test_type='review'` over the roster; `overdue` = issued, ungraded, older than 2 days. Read-only by design (loop phase 4); scheduling itself lives in the practice review scheduler, not the teacher portal.

---

## 5. How the Teacher Portal benefits the teacher — [Plain]

- **No more writing or marking question papers.** The AI generates fresh, syllabus-aligned tests and grades them instantly — the most time-consuming part of the job disappears.
- **Full control when it matters.** A teacher who wants a specific paper can write their own questions and still get AI grading, instant results, and the same analytics.
- **Assign in minutes, to a whole class.** A few clicks send personalised practice to every student, each with their own version (which also discourages copying).
- **Know exactly where the class stands.** Instead of guessing, the teacher sees a live picture of class and topic mastery — plus an AI-written one-paragraph read of the class — so re-teaching targets the real gaps.
- **From "at risk" to "assigned" in one click.** The dashboard doesn't just flag a struggling student; it drafts the remedial assignment for them.
- **Better parent conversations.** Concrete, per-student evidence (scores, trends, weak topics) replaces vague impressions.
- **Less admin, more teaching.** Collection, marking, and report-writing are automated, returning hours each week.

---

## 6. How the Teacher Portal benefits everyone else — [Plain]

**Students**
- Get well-structured, curriculum-aligned practice chosen by someone who knows their level, with clear deadlines that build study discipline.
- Each student gets their own version of a test and instant graded feedback — fairer and faster than a shared paper marked days later.

**Parents**
- See that their child is getting real, teacher-directed practice and can follow the results in their own portal — reassurance that school and home are aligned.

**Schools & coaching institutes (organizations)**
- Standardise practice and assessment quality across many teachers and classes.
- Gain measurable, comparable outcome data across cohorts.
- The org `linkingCode` + admin approval gives leadership control over who represents the institute on the platform.

**Admins / the platform**
- Teacher verification keeps the ecosystem trustworthy and abuse-resistant.
- Teacher-driven assignments increase student usage and stickiness, supporting subscriptions and renewals.
- Teacher review of AI-generated tests is a natural human-in-the-loop quality signal for the content and AI teams.

---

## 7. Honest limitations & current edges — [Technical]

- Still the **smallest portal by surface area**, but no longer test-free: Playwright now covers auth setup, a portal smoke pass, a11y, and the manual-assignment flow (`tests/e2e/teacher-portal.spec.ts`, `teacher-a11y.spec.ts`, `teacher-manual-assignment.spec.ts`), plus Vitest units across `src/lib/teachers/**` and `src/lib/assignments/manual-*`. AI-assignment publish and submissions review still lack e2e coverage.
- Mutating `/api/teacher/*` routes pass through `teacherProxyGate` (Origin/CSRF), but the only published teacher API route is still `reports/[testId]/pdf` (GET) — all teacher writes are server actions, which are now per-teacher rate-limited (`consumeTeacherPortalDataActionRateLimit`, fail-closed in prod).
- **Manual-assignment edges:** edits to a published manual assignment apply only to students who haven't started (already-started students keep the old questions — by design, but easy to misread as a bug); the update action cannot add/remove students; manual assignments cap at 50 questions and there's no import from an existing AI test or another assignment.
- **No hand-editing of AI-generated items** — teachers can author from scratch (manual mode) but cannot tweak a question the AI produced.
- **Rejection cooldown is still inert:** the signup-side 24h check (`hasRecentTeacherRejection`) reads `teacher_approval_history.action='rejected'`, but the admin reject route still writes only `admin_action_log` — no `'rejected'` history row is ever inserted (TCH-R14).
- **Class insight is per-teacher and cache-bound:** no org pooling (two teachers in one org generate separate insights), and a fingerprint-matching cached insight is served as-is until grades change or the teacher hits Regenerate. The at-risk planner requires the student to have below-target topic data; if the model returns unusable topic picks it silently falls back to the weakest few topics (`resolveFocusTopics`).
- **Auto-retest card is class-wide totals only** (all subjects, fixed 2-day overdue window) — no per-student or per-subject drilldown yet.

---

## 8. PDR-style specification — current code state (for LLM planning)

> **How to read this section.** Mirrors the canonical *Product Design Requirements* (PDR v3.0, referenced inline as `PDR §x.y`). Teacher onboarding/roster/assignments belong to the **core PDR**; assignment hardening landed in migrations `20260618130000` (assignments + assignment_submissions), manual authoring in `20260705000600` (assignment_questions + RPC), and the insight cache in `20260630000000`–`20260701000100`. Each requirement has a local ID (`TCH-R#`), a **Status** in `[BRACKETS]`, file **evidence**, and (for gaps) a **Hook:** pointer.
> **Status legend:** `[IMPLEMENTED]` · `[PARTIAL]` · `[GAP]` · `[PLANNED]`.

### 8.1 Entity state machines

**Teacher verification** (`profiles.isVerified` + `teacher_approval_history.action`)
```
sign-up ──▶ unverified (is_verified=false)  ── shown app/teacher/pending
   │
admin action (app/api/admin/teachers/[id]/...):
   ├─ approve        ▶ verified   (is_verified=true; history.action='verified' + email + welcome card + strict admin audit)
   ├─ reject         ▶ rejected   (admin_action_log only — 'rejected' history row NOT yet written, see TCH-R14)
   └─ request-info   ▶ unverified (needs-info; no status column — informational)
verified ── admin unverify ──▶ unverified (history.action='unverified')
gate: app/teacher/(protected) requires verified via getVerifiedTeacherSession()
```
`TeacherApprovalAction = "verified" | "unverified" | "rejected"` (`src/db/schema/teacher-approval-history.ts`).

**Assignment** (`assignments.status`) and **per-student submission** (`assignment_submissions.lifecycleStatus`)
```
assignment:   draft ──(publish)──▶ published   (publishedAt set; fan-out begins)
              (manual drafts are editable/resumable at /teacher/assignments/[id]/edit)

submission (one row per targeted student, unique (assignment_id, student_id)):
  pending_materialize ──▶ ready ──▶ in_progress ──▶ submitted ──▶ grading ──▶ graded
            │                                                        │
            ├─▶ failed_generation (retryable)                        └─▶ grading_failed
            │
  materialisation: AI     → assign_generate_test practice_job (LLM pipeline)
                   manual → practice_create_manual_assigned_test RPC (template copy, no LLM)
  past dueAt ⇒ isLate, penaltyApplied
```
Persisted: `src/db/schema/teaching.ts`. AI materialisation via `practice_jobs` (`assign_generate_test`, partial-unique on active jobs per submission); manual materialisation branch selected in `src/lib/admin/assignment-generation.ts` when `config.authoring_mode === 'manual'`.

**Org membership** (`teacher_organization_memberships.status`)
```
active ──(admin/teacher revoke)──▶ revoked (revokedAt)
INVARIANT: at most ONE active membership per teacher (partial unique idx idx_teacher_org_memberships_one_active)
```

### 8.2 Functional requirements & current status

| ID | Requirement | Status | Evidence | PDR |
|---|---|---|---|---|
| TCH-R1 | Teacher signs up with an org + org `linkingCode`; held at `pending` until admin approval. | `[IMPLEMENTED]` | `app/(auth)/signup/teacher/`, `organizations.linkingCode`, `app/teacher/pending` | core |
| TCH-R2 | Admin approves/rejects/requests-info; transitions recorded in history. | `[IMPLEMENTED]` | `app/api/admin/teachers/**`, `teacher_approval_history` | core |
| TCH-R3 | Protected area enforces verified-teacher session; rejects suspended. | `[IMPLEMENTED]` | `app/teacher/(protected)/layout.tsx` → `requireVerifiedTeacher()` → `getVerifiedTeacherSession()`; suspended→`/login?suspended=1`, not_verified→`/teacher/pending` | core |
| TCH-R4 | Roster of students scoped to the teacher's org + roster grade/subject and/or active links. | `[IMPLEMENTED]` | `profiles.organizationId/teacherRosterGrade/SubjectId`, `teacher_student_links` | core |
| TCH-R5 | Create assignment with config (subject/topics/grade/difficulty/count), instructions, due date; publish fans out per-student submissions + generation jobs. Due date must be in the future. | `[IMPLEMENTED]` | `assignments`, `assignment_submissions`, `src/lib/admin/assignment-generation.ts`, `src/lib/assignments/assignment-due-at.ts` | core |
| TCH-R6 | Each student gets a distinct, curriculum-grounded test (same pipeline as self-practice). | `[IMPLEMENTED]` | `practice_jobs` → `practice-generation-pipeline.ts` | core |
| TCH-R7 | Review submissions (who/when/score/late) and open full graded reports for own students. | `[IMPLEMENTED]` | `app/api/teacher/reports/[testId]/pdf`, `assignment_submissions`, `teacher-submissions-hub.ts` | core |
| TCH-R8 | Per-student performance drilldown. | `[IMPLEMENTED]` | `student-performance`, `performance_tracker` | core |
| TCH-R9 | Cohort/topic analytics + at-risk performance bands. | `[IMPLEMENTED]` | `topic-performance`, `teacher-dashboard-performance-band-strip.tsx` | core |
| TCH-R10 | Late penalty semantics (isLate, penaltyApplied) on overdue submissions. | `[IMPLEMENTED]` | `assignment_submissions.isLate/penaltyApplied` | core |
| TCH-R11 | Origin/CSRF gate on mutating `/api/teacher/*`. | `[IMPLEMENTED]` | `teacherProxyGate` (`src/lib/teachers/proxy-guard.ts`) rejects mismatched Origin on POST/PUT/PATCH/DELETE (forward-compat: only `reports/[testId]/pdf` GET published today; teacher writes are server actions) | core (security) |
| TCH-R12 | Tenant-boundary enforcement on roster/settings mutations (resolve org from session). | `[IMPLEMENTED]` | `org-roster-actions.ts` + `account-actions.ts` derive org via `getActiveTeacherOrganizationSnapshot(session.user.id)` and update `.eq("id", user.id)`; bodies carry filters only | core (authz) |
| TCH-R13 | Audit + email on pending→verified transition. | `[IMPLEMENTED]` | `app/api/admin/teachers/[id]/approve/route.ts`: `recordTeacherApprovalHistory('verified')` + `sendTeacherApprovedEmail` + `insertTeacherWelcomeNotification` + `writeAdminActionStrict` (before/after `is_verified` in payload) | core |
| TCH-R14 | Re-signup cooldown after rejection (anti-spam). | `[PARTIAL]` | `hasRecentTeacherRejection` (24h, `src/lib/auth/teacher-recent-rejection-check.ts`) is wired into `app/(auth)/signup/teacher/actions.ts` (unit-tested in `tests/auth/signup/teacher-cooldown.test.ts`), but the admin `reject` route still only writes `admin_action_log` — no `'rejected'` `teacher_approval_history` row, so the cooldown remains inert | core |
| TCH-R15 | Teacher hand-authoring/editing of question content. | `[PARTIAL]` | Authoring from scratch shipped as manual assignments (TCH-R17); hand-editing **AI-generated** items is still not possible | — |
| TCH-R16 | Automated e2e/unit coverage of teacher flows. | `[PARTIAL]` | `tests/e2e/educator-auth.setup.ts`, `teacher-portal.spec.ts`, `teacher-a11y.spec.ts`, `teacher-manual-assignment.spec.ts`; Vitest across `src/lib/teachers/**` + `src/lib/assignments/manual-*`/`assignment-due-at`. No e2e yet for AI-assignment publish or submissions review | — |
| TCH-R17 | Manual (teacher-authored) assignments: 5 question types with answer keys, draft save/resume, publish to selected students, post-publish edit applying only to not-yet-started students; materialised per student without an LLM call; graded by the standard AI pipeline. | `[IMPLEMENTED]` | `assignments/manual-actions.ts`, `src/lib/assignments/manual-{schemas,queries,helpers}.ts`, `assignment_questions`, `practice_create_manual_assigned_test` (`20260705000600`), `src/components/teacher/manual/**`, `assignments/[id]/edit` | core (extension) |
| TCH-R18 | AI class insight on the dashboard, scoped to the active grade/section/subject filter, with a fingerprint-validated cache (no token spend on cache hits or scope browsing). | `[IMPLEMENTED]` | `teacher-dashboard-insight-card.tsx`, `teacher-class-insight{,-service,-cache}.ts`, `teacher_class_insights` (`20260630000000`+) | core (extension) |
| TCH-R19 | At-risk intervention: AI diagnosis + suggested remedial assignment (title/difficulty/focus topics) per flagged student, publishable in one click with full server-side re-validation. | `[IMPLEMENTED]` | `dashboard/at-risk-intervention-actions.ts`, `teacher-at-risk-intervention{,-dialog}.ts(x)`, `teacher-student-weak-topics-queries.ts` | core (extension) |
| TCH-R20 | Read-only auto-retest (review-loop) summary over the roster: issued / completed / overdue. | `[IMPLEMENTED]` | `review-summary-card.tsx`, `src/lib/teachers/teacher-review-summary.ts` (`tests.test_type='review'`, 2-day overdue window) | loop phase 4 |
| TCH-R21 | Code-based Link Student restricted to independent teachers; org teachers redirected to the student directory (nav item hidden). | `[IMPLEMENTED]` | `app/teacher/(protected)/students/page.tsx` (redirect on active org), `teacher-nav-main.tsx`/`teacher-app-sidebar.tsx`; server-side RPC gate unchanged | core (authz) |
| TCH-R22 | Rate limiting: IP-keyed limit on teacher signup; per-teacher limit (120/60s, fail-closed in prod) on portal data/mutation server actions. | `[IMPLEMENTED]` | `consumeAuthSignup` (`src/lib/auth/rate-limit.ts`) in `signup/teacher/actions.ts`; `consumeTeacherPortalDataActionRateLimit` (`teacher-portal-action-rate-limit.ts`) in `manual-actions.ts`, `at-risk-intervention-actions.ts`, `org-roster-actions.ts`, dashboard actions | core (security) |

### 8.3 Data contracts & invariants (enforced)
- **One active org membership per teacher** — `idx_teacher_org_memberships_one_active` (partial unique where `status='active'`).
- **One submission per (assignment, student)** — `unique(assignment_id, student_id)` on `assignment_submissions`.
- **One active generation job per submission** — `practice_jobs_assignment_generate_active_uq` (partial unique where `job_type='assign_generate_test' AND status IN ('pending','running')`).
- **Job XOR check** — `assign_generate_test` jobs carry `assignment_submission_id` and null `test_id`; all other jobs carry `test_id` and null `assignment_submission_id` (`practice_jobs_required_ids_check`).
- **One authored question per slot** — `assignment_questions_number_uq` unique (assignment_id, question_number); `question_type` CHECK-constrained to the five supported types.
- **Manual materialization guard rails** — `practice_create_manual_assigned_test` is service-role-only and re-validates: assignment `published`, submission `pending_materialize`/`failed_generation`, target is a student profile, `teacher_can_access_student`, `authoring_mode='manual'`, 1–200 questions, sane duration. Idempotent: returns the existing `test_id` if already materialised.
- **One insight per (teacher, scope, prompt_version)** — `teacher_class_insights_scope_uniq` unique index with `NULLS NOT DISTINCT`; table is service-role-only (no RLS policies = no PostgREST access).
- **One `assignment_graded` bell card per (recipient, submission)** — partial unique index `uq_notifications_assignment_graded_recipient_ref` (`20260705000000`) makes re-grades idempotent for students/parents.
- **Read scope** — teacher report access must be filtered to the teacher's own students (`teacherOwnsAssignmentTest` in the PDF route); do not expose arbitrary `testId`.

### 8.4 Telemetry & observability
- Approval transitions → `teacher_approval_history` (approve) + `admin_action_log` (approve strict, reject best-effort).
- Teacher server actions run in `withTeacherActionTelemetry` (`teacher-action-observability.ts`): named Sentry breadcrumbs per phase (`validation_failed`, `rate_limited`, `assignment_published`, …) + error classification via `classify-teacher-action-error.ts`.
- LLM spend is attributed in `ai_calls` per feature: `teacher.dashboard_insight` (class insight) and `teacher.at_risk_intervention`. Insight cache effectiveness = `sum(teacher_class_insights.served_count)` vs fresh generations; `last_served_at` feeds the weekly prune cron (`teacher-class-insight-prune-weekly`, Sun 03:00 UTC, 90-day staleness).
- Report-PDF access is rate-limited and audit-logged (`teacher-report-pdf-rate-limit.ts`, `teacher-report-pdf-audit-log.ts`).
- Dashboard aggregations: candidates for `Promise.all` parallelism + short `unstable_cache`.

### 8.5 Known gaps & next-step hooks (ordered)
1. **TCH-R14 re-signup cooldown** `[PARTIAL]` — signup check, rate limit, and unit test are wired; **Hook:** make `app/api/admin/teachers/[id]/reject/route.ts` persist a `'rejected'` `teacher_approval_history` row (via `src/lib/admin/teacher-approval-history.ts`, mirroring the approve route) so `hasRecentTeacherRejection` actually fires.
2. **TCH-R16 tests** `[PARTIAL]` — **Hook:** add e2e for the AI-assignment publish → fan-out → submissions-review path (`tests/e2e/`); the manual flow already has `teacher-manual-assignment.spec.ts` to crib from.
3. **TCH-R15 AI-item editing** `[PARTIAL]` — manual authoring shipped (TCH-R17); hand-editing AI-generated items remains a deliberate boundary. If product wants it, reuse the `assignment_questions` editor components against a generated-items copy + re-materialisation for not-yet-started students.
4. **TCH-R20 auto-retest drilldown** — the summary card is class-wide totals only; **Hook:** extend `loadTeacherReviewSummary` with per-student/per-subject grouping if teachers ask "who is overdue?".
5. **Manual assignment roster edits** — `updateManualAssignmentInputSchema` has no `student_ids`; **Hook:** add add/remove-students support to `updatePublishedManualAssignment` (new submissions fan-out + RPC materialisation) if requested.
