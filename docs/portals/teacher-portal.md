# 24Vertex — Teacher Portal

**Snapshot:** 2026-05-31 · branch `claude/festive-goldberg-e79b4b` @ `8f69969`. The §8 status tags were re-verified against current code on this date (superseding the older `docs/audit/*` snapshot of 2026-05-17).
**Product:** 24Vertex (technical slug `vertex24`; legacy `eduai`)
**Audience for this doc:** mixed. **[Plain]** sections are for any human reader (teachers, school leaders, parents, business). **[Technical]** sections are dense and name concrete files, tables, routes, and flows for engineers and LLMs.
**Scope:** `app/teacher/**`, `app/api/teacher/**`, `src/lib/teachers/**`, `src/lib/assignments/**`, `src/lib/auth/require-verified-teacher.ts`, and the admin-side approval surface in `src/lib/admin/teacher-approval*.ts`.

---

## 1. What the Teacher Portal is — [Plain]

The Teacher Portal lets an educator use 24Vertex's AI engine with a real class. A verified teacher can:

- **Assign AI-generated practice tests** to their students with a due date.
- **See a roster** of the students linked to them.
- **Review submissions and results** once students complete the work.
- **Read class-wide and per-student analytics** — which students and which topics need attention.
- **Manage their own profile and notification settings.**

The teacher doesn't have to write or mark questions. They decide *what* to assign and *to whom*; the platform generates, delivers, and grades it, then hands back the insights.

---

## 2. How the Teacher Portal fits the wider platform — [Plain]

- A teacher belongs to an **organization** (a school or coaching institute) by entering a code the admin gave them.
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
- **Sign-up:** teacher signs up via Supabase Auth (`app/(auth)/signup/teacher/`), supplying org + the org `linkingCode`. Creates a `profiles` row with `role = 'teacher'`, `isVerified = false`.
- **Pending gate:** `app/teacher/pending` is shown until an admin approves. The protected area lives under the `app/teacher/(protected)/` route group with its own `layout.tsx`.
- **Verification helper (in use):** `app/teacher/(protected)/layout.tsx` calls `requireVerifiedTeacher()` (`src/lib/auth/require-verified-teacher-layout.ts`), wrapping `getVerifiedTeacherSession()` (`require-verified-teacher.ts`). Asserts authenticated + `role='teacher'` + `isVerified=true`, and redirects on `suspended` → `/login?suspended=1`, `not_verified` → `/teacher/pending`, `not_signed_in` → `/login`. Also reachable via the shared `requireUser({ role:'teacher' })` (`require-user.ts`).
- **Admin approval flow:** `app/api/admin/teachers/**` (`pending`, `[id]/approve`, `/reject`, `/request-info`) drives the state machine; transitions recorded in `teacher_approval_history`. Re-signup spam after rejection is meant to be throttled via that history.
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
| `assignments` | A teacher-created assignment: `teacherId`, `organizationId`, `assignmentKind` (default `practice_test`), `title`, `instructions`, `config` (jsonb: subject/topics/grade/difficulty/question mix), `dueAt`, `status` (`draft`/`published`), `publishedAt`. |
| `assignment_submissions` | Per-student row for an assignment (`studentId`, `testId`, `lifecycleStatus`, `score`, `submittedAt`, `gradedAt`, `isLate`, `penaltyApplied`). Unique per (assignment, student). |
| `tests`, `questions`, `student_answers`, `test_reports` | The actual generated test + answers + graded report a teacher reviews (read access scoped to their students). |
| `performance_tracker` | Per-(student, topic) mastery the teacher aggregates for class/topic analytics. |
| `practice_jobs` | Async queue that materialises an assignment into a per-student `tests` row (`assign_generate_test`). |

### 3.4 Routes (pages)
- `app/teacher/pending` — pre-approval holding page.
- `app/teacher/(protected)/dashboard` — class overview + at-risk/performance bands.
- `app/teacher/(protected)/assignments` — create/manage assignments.
- `app/teacher/(protected)/students` — roster.
- `app/teacher/(protected)/submissions` — submitted work + results.
- `app/teacher/(protected)/student-performance` — per-student drilldown.
- `app/teacher/(protected)/topic-performance` — topic/chapter mastery across the cohort.
- `app/teacher/(protected)/settings` — profile, notifications, org roster.

### 3.5 Server actions & API routes
- **Assignment lifecycle:** server actions create/edit/publish/delete `assignments`; publishing fans out `assignment_submissions` per targeted student and enqueues `practice_jobs` to generate each student's test. Admin-side generation helpers: `src/lib/admin/assignment-generation.ts`, `assignments-admin.ts` (shared logic).
- **Dashboard/analytics data:** `app/teacher/(protected)/dashboard/teacher-dashboard-data.ts` and friends aggregate performance, at-risk students, and bands (`teacher-dashboard-performance-band-strip.tsx`).
- **Reports:** `app/api/teacher/reports/[testId]` (+ `/pdf`) renders a student's graded report for teacher review (same React-PDF document used in the student portal, access-scoped to the teacher's students).
- **Roster/settings:** `org-roster-actions.ts`, `account-actions.ts` (tenant boundary should resolve `organizationId` from the session, not the request body).

### 3.6 Relationship model — how teachers reach students
- **Org-scoped:** teacher and students share an `organizationId`; the roster grade/subject (`teacherRosterGrade`, `teacherRosterSubjectId`) narrows which students a teacher owns.
- **Explicit links:** `teacher_student_links` records the active teacher↔student edges.
- **Assignment targeting:** an assignment is owned by `teacherId` (+ `organizationId`); submissions are created for the targeted students.

### 3.7 Authoring vs. consumption
Teachers **do not** hand-author question content. They **configure** what the AI should generate (subject, topics, grade, difficulty, count) via the assignment `config`; the same multi-stage generation + grading pipelines that power student self-practice (see the Student Portal doc, §3.6) produce and grade the assigned tests. This keeps teacher effort low and content consistent.

---

## 4. Capabilities, feature by feature

### 4.1 Get verified & join an organization
- **[Plain]** A teacher signs up, names their school/institute with the code the admin gave them, and waits for a quick approval. This keeps students safe from unverified strangers.
- **[Technical]** Supabase sign-up → `profiles(role='teacher', is_verified=false)` + `teacher_organization_memberships`. Held at `app/teacher/pending` until an admin flips `is_verified` via `app/api/admin/teachers/[id]/approve`; recorded in `teacher_approval_history`.

### 4.2 Build a roster of students
- **[Plain]** The teacher sees the students they're responsible for, grouped by grade/section, so they know exactly who they can assign to and track.
- **[Technical]** `students` page reads students sharing the teacher's `organizationId` (filtered by roster grade/subject) and/or `teacher_student_links` with `status='active'`.

### 4.3 Create and publish assignments
- **[Plain]** The teacher creates an assignment — pick the subject and chapters, set difficulty and number of questions, add instructions and a due date — and publishes it to the class. Every student gets their own version of the test.
- **[Technical]** Assignment server action writes an `assignments` row (`config` jsonb, `dueAt`, `status`). Publish → `status='published'`, fan-out `assignment_submissions` (unique per student) → enqueue `assign_generate_test` `practice_jobs`. Generation runs the standard pipeline so each student gets a distinct, curriculum-grounded test.

### 4.4 Review submissions & results
- **[Plain]** As students finish, the teacher sees who submitted, who's late, the scores, and can open any student's full graded report with model answers and feedback.
- **[Technical]** `submissions` page reads `assignment_submissions` (status/score/`isLate`/`penaltyApplied`) joined to `tests`/`test_reports`; full report via `app/api/teacher/reports/[testId]` (+ PDF), access-scoped to the teacher's students.

### 4.5 Per-student performance drilldown
- **[Plain]** For any student, the teacher sees strengths, weak topics, and whether they're improving — useful for parent meetings and targeted help.
- **[Technical]** `student-performance` reads `performance_tracker` for that student across subjects/topics; charts via Recharts.

### 4.6 Topic / cohort analytics
- **[Plain]** A class-wide view of which chapters most students are struggling with, so the teacher knows what to re-teach.
- **[Technical]** `topic-performance` aggregates `performance_tracker` across the roster; dashboard surfaces at-risk students and performance "bands" (red/amber/green).

### 4.7 Settings
- **[Plain]** Update profile (subjects taught, school, bio, photo), control notifications, and manage roster details.
- **[Technical]** `settings` sections + `*-actions.ts`. Mutations should assert the session's `organizationId`/`teacherId` rather than trusting request payloads.

---

## 5. How the Teacher Portal benefits the teacher — [Plain]

- **No more writing or marking question papers.** The AI generates fresh, syllabus-aligned tests and grades them instantly — the most time-consuming part of the job disappears.
- **Assign in minutes, to a whole class.** A few clicks send personalised practice to every student, each with their own version (which also discourages copying).
- **Know exactly where the class stands.** Instead of guessing, the teacher sees a live picture of class and topic mastery — so re-teaching targets the real gaps.
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

- This is the **smallest portal by surface area and the lightest on automated tests** (per `docs/audit/teacher-portal.md`): essentially no Playwright e2e coverage historically.
- The protected layout now uses `requireVerifiedTeacher()` with suspended / not-verified / not-signed-in all handled — the audit's hand-rolled-check finding is resolved.
- Mutating `/api/teacher/*` routes now pass through `teacherProxyGate` (Origin/CSRF). The only published teacher route today is `reports/[testId]/pdf` (GET), so the gate is forward-compat scaffolding; add per-route rate limits when write routes ship.
- Org-roster mutations need careful **tenant-boundary** enforcement (resolve `organizationId` from session).
- No teacher-facing **manual question authoring/editing** of generated content — teachers configure generation but don't hand-edit items. (By design, but a known capability boundary.)
- Approval-transition auditing/notification fan-out has been only partially wired.

---

## 8. PDR-style specification — current code state (for LLM planning)

> **How to read this section.** Mirrors the canonical *Product Design Requirements* (PDR v3.0, referenced inline as `PDR §x.y`). Teacher onboarding/roster/assignments belong to the **core PDR**; assignment hardening landed in migrations `20260618130000` (assignments + assignment_submissions). Each requirement has a local ID (`TCH-R#`), a **Status** in `[BRACKETS]`, file **evidence**, and (for gaps) a **Hook:** pointer.
> **Status legend:** `[IMPLEMENTED]` · `[PARTIAL]` · `[GAP]` · `[PLANNED]`.

### 8.1 Entity state machines

**Teacher verification** (`profiles.isVerified` + `teacher_approval_history.action`)
```
sign-up ──▶ unverified (is_verified=false)  ── shown app/teacher/pending
   │
admin action (app/api/admin/teachers/[id]/...):
   ├─ approve        ▶ verified   (is_verified=true; history.action='verified')
   ├─ reject         ▶ rejected   (history.action='rejected')
   └─ request-info   ▶ unverified (needs-info; no status column — informational)
verified ── admin unverify ──▶ unverified (history.action='unverified')
gate: app/teacher/(protected) requires verified via getVerifiedTeacherSession()
```
`TeacherApprovalAction = "verified" | "unverified" | "rejected"` (`src/db/schema/teacher-approval-history.ts`).

**Assignment** (`assignments.status`) and **per-student submission** (`assignment_submissions.lifecycleStatus`)
```
assignment:   draft ──(publish)──▶ published   (publishedAt set; fan-out begins)

submission (one row per targeted student, unique (assignment_id, student_id)):
  pending_materialize ──▶ ready ──▶ in_progress ──▶ submitted ──▶ graded
            │  (assign_generate_test job builds a tests row)        │
            └──────────────────────────────▶ failed                 └─ late  (past dueAt ⇒ isLate, penaltyApplied)
```
Persisted: `src/db/schema/teaching.ts`. Materialisation via `practice_jobs` (`assign_generate_test`, partial-unique on active jobs per submission).

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
| TCH-R5 | Create assignment with config (subject/topics/grade/difficulty/count), instructions, due date; publish fans out per-student submissions + generation jobs. | `[IMPLEMENTED]` | `assignments`, `assignment_submissions`, `src/lib/admin/assignment-generation.ts` | core |
| TCH-R6 | Each student gets a distinct, curriculum-grounded test (same pipeline as self-practice). | `[IMPLEMENTED]` | `practice_jobs` → `practice-generation-pipeline.ts` | core |
| TCH-R7 | Review submissions (who/when/score/late) and open full graded reports for own students. | `[IMPLEMENTED]` | `app/api/teacher/reports/[testId]` (+ pdf), `assignment_submissions` | core |
| TCH-R8 | Per-student performance drilldown. | `[IMPLEMENTED]` | `student-performance`, `performance_tracker` | core |
| TCH-R9 | Cohort/topic analytics + at-risk performance bands. | `[IMPLEMENTED]` | `topic-performance`, `teacher-dashboard-performance-band-strip.tsx` | core |
| TCH-R10 | Late penalty semantics (isLate, penaltyApplied) on overdue submissions. | `[IMPLEMENTED]` | `assignment_submissions.isLate/penaltyApplied` | core |
| TCH-R11 | Origin/CSRF gate on mutating `/api/teacher/*`. | `[IMPLEMENTED]` | `teacherProxyGate` (`src/lib/teachers/proxy-guard.ts`) rejects mismatched Origin on POST/PUT/PATCH/DELETE (forward-compat: only `reports/[testId]/pdf` GET published today) | core (security) |
| TCH-R12 | Tenant-boundary enforcement on roster/settings mutations (resolve org from session). | `[PARTIAL]` | `org-roster-actions.ts` — verify it ignores body-supplied org_id | core (authz) |
| TCH-R13 | Audit + email on pending→verified transition. | `[PARTIAL]` | `src/lib/admin/teacher-approval.ts` writes row; downstream fan-out partial | core |
| TCH-R14 | Re-signup cooldown after rejection (anti-spam). | `[PARTIAL]` | `hasRecentTeacherRejection` (24h, `teacher-recent-rejection-check.ts`) is wired into `app/(auth)/signup/teacher/actions.ts`, but the admin `reject` route doesn't persist a `'rejected'` `teacher_approval_history` row yet, so the cooldown is currently inert | core |
| TCH-R15 | Teacher hand-authoring/editing of generated questions. | `[GAP]` | not built — teachers configure generation only | — |
| TCH-R16 | Automated e2e/unit coverage of teacher flows. | `[GAP]` | no `tests/e2e/teacher-*.spec.ts` | — |

### 8.3 Data contracts & invariants (enforced)
- **One active org membership per teacher** — `idx_teacher_org_memberships_one_active` (partial unique where `status='active'`).
- **One submission per (assignment, student)** — `unique(assignment_id, student_id)` on `assignment_submissions`.
- **One active generation job per submission** — `practice_jobs_assignment_generate_active_uq` (partial unique where `job_type='assign_generate_test' AND status IN ('pending','running')`).
- **Job XOR check** — `assign_generate_test` jobs carry `assignment_submission_id` and null `test_id`; all other jobs carry `test_id` and null `assignment_submission_id` (`practice_jobs_required_ids_check`).
- **Read scope** — teacher report access must be filtered to the teacher's own students; do not expose arbitrary `testId`.

### 8.4 Telemetry & observability
- Approval transitions → `teacher_approval_history` (+ intended `admin_action_log`).
- Dashboard aggregations: candidates for `Promise.all` parallelism + short `unstable_cache`.
- Sentry breadcrumbs around teacher actions are `[PARTIAL]`.

### 8.5 Known gaps & next-step hooks (ordered)
1. **TCH-R3 verified+suspended gate** `[IMPLEMENTED]` — layout uses `requireVerifiedTeacher()`; suspended/not-verified branches handled. No action needed.
2. **TCH-R11 CSRF** `[IMPLEMENTED]` via `teacherProxyGate`. Remaining: add `applyRateLimit` to teacher dashboard data + assignment mutations once write routes are published.
3. **TCH-R12 tenant boundary** `[PARTIAL]` — **Hook:** in `org-roster-actions.ts`/`account-actions.ts`, resolve `organizationId`/`teacherId` from session, assert target rows match.
4. **TCH-R13 approval audit + email** `[PARTIAL]` — **Hook:** in `src/lib/admin/teacher-approval.ts`, write `admin_action_log` + enqueue a Resend confirmation on verify.
5. **TCH-R14 re-signup cooldown** `[PARTIAL]` — signup check is already wired; **Hook:** make `app/api/admin/teachers/[id]/reject/route.ts` persist a `'rejected'` `teacher_approval_history` row (via `src/lib/admin/teacher-approval-history.ts`) so `hasRecentTeacherRejection` actually fires.
6. **TCH-R16 tests** `[GAP]` — **Hook:** add `tests/e2e/educator-auth.setup.ts` + `teacher-portal.spec.ts`; Vitest for `*-actions.ts`.
7. **TCH-R15 item authoring** `[GAP]` — capability boundary; only build if product wants teacher-edited content (would need an editable items table + review flow).
