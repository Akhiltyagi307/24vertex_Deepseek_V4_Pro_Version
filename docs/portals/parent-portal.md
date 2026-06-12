# 24Vertex — Parent Portal

**Snapshot:** 2026-06-12 · branch `main` @ `27d7fbb`. The §8 status tags were re-verified against current code on this date (superseding the 2026-05-31 snapshot `8f69969`).
**Product:** 24Vertex (technical slug `vertex24`; legacy `eduai`)
**Audience for this doc:** mixed. **[Plain]** sections are for any human reader (parents, business, support). **[Technical]** sections are dense and name concrete files, tables, routes, and flows for engineers and LLMs.
**Scope:** `app/parent/**`, `app/api/parent/**`, `src/lib/parent/**`, `src/lib/auth/link-parent-rpc-errors.ts`, `src/lib/student/review-advisory.ts` (consumed by the parent performance page), and the parent-linking migrations/RPCs.

---

## 1. What the Parent Portal is — [Plain]

The Parent Portal lets a parent or guardian follow their child's learning on 24Vertex without interfering with it. After linking to their child, a parent can:

- **See the child's progress** — subject and topic mastery, trends, strengths and weak spots.
- **See what the child should focus on next** — a short ranked list of topics due for revision or needing strengthening.
- **Read the child's test reports** — the same graded results the student sees.
- **Review the child's AI doubt history and answered questions** (oversight of what's being asked and learned).
- **Track assignments** the teacher set and whether they're done.
- **Manage the subscription / payment** for the child's plan.
- **Get notifications** about reports, assignments, and plan usage.

It is primarily an **oversight and support** portal: parents observe and pay, students do the work.

---

## 2. How the Parent Portal fits the wider platform — [Plain]

- A parent creates their own account, then **links to their child** using a short code the child has (or by matching the child's registered parent email). If no parent email is on the child's account, the **child approves the link** from their own app before the parent sees anything.
- Once linked, the parent sees a **read-only-style window** into that child's activity.
- A parent can be linked to **more than one child** and switch between them.
- The child remains the owner of their data; the parent is a trusted viewer and bill-payer.
- **Teachers** and **admins** see overlapping views of the same student; the parent's view is scoped strictly to their own linked children.

---

## 3. Current technical setup — [Technical]

### 3.1 Stack and where it lives
Same platform foundation as the rest of 24Vertex (Next.js 16 App Router, Supabase Postgres + Auth, Drizzle, Tailwind v4 + shadcn/Radix, Recharts, Vercel, Sentry). Parent code lives under `app/parent/**` and `src/components/parent/**`. Noted as the **cleanest portal** in the codebase with the best audit-logging discipline (`docs/audit/parent-portal.md`).

### 3.2 Access control & the "active child" model
- Guarded by `app/parent/layout.tsx` (profile load + `role='parent'` + not suspended).
- A parent linked to multiple children selects an **active child**; the selection is stored in an `httpOnly` cookie set by `app/parent/select-student/actions.ts`. Every page re-asserts the link server-side via `assertParentActiveLink` (cookie is a convenience, not the authority).
- `app/parent/(portal)/layout.tsx` now runs the link assertion and the child-profile read **concurrently** (`Promise.all`), saving a DB round-trip on every parent page load (perf commit `933bacf`); the `linked` result is still checked before the child row is trusted.
- `app/parent/open-report/route.ts` is a server-side redirect that opens a specific child's report (UUID-validated inputs). It additionally verifies the test **belongs to the linked student** before writing the audit row / redirecting (security commit `e216a70`), so a linked parent can't poison `parent_audit` with arbitrary test ids.
- The portal layout also gates a **first-run onboarding tour** for parents created within the last 30 days who haven't dismissed the welcome (`profiles.onboarding_welcome_seen_at`, migration `20260704040000_onboarding_welcome_seen.sql`; component `src/components/onboarding/parent-onboarding.tsx`, persisted via `markWelcomeSeen` in `src/lib/onboarding/welcome-actions.ts`).

### 3.3 The linking flow (security-critical)
- `app/parent/link-child` accepts the child's 8-char `studentLinkCode` (format `XXX12345`, on `profiles`) **or** the student UUID; `linkParentSchema` (`src/lib/validations/auth.ts`) is `.strict()` and upper-cases codes, and the RPC upper-cases again in-DB.
- The action calls the `link_parent_to_student(p_student_ref)` SECURITY DEFINER RPC, which **returns the link status as text**:
  - student has a guardian email on file **matching** the parent's auth email ⇒ row created `active`;
  - guardian email on file but **mismatching** ⇒ error (`Parent email does not match student record`), no row;
  - **no guardian email on file** ⇒ row created `pending`; the student must approve it in `app/student/settings` (RPCs `confirm_parent_link` / `reject_parent_link`, loader `src/lib/parent/pending-parent-links.ts`). Confirmation back-fills `parent_email`/`parent_name` on the student profile and activates the link; rejection sets it `revoked`. Guardian fields are **never** back-filled at link time.
- **Regression history (important):** the confirmation gate added by `20260525150000_parent_link_student_confirmation.sql` was silently **overwritten** by the rebrand migration `20260621130000_vertex24_bypass_profile_guard.sql` (unconditional `active` + guardian back-fill — any parent account could claim an orphan student). Migration `20260706000000_restore_parent_link_confirmation_and_harden_admin_rpcs.sql` (commit `dca4d20`, review finding M1) restores the secure flow as the authoritative definition, idempotently (explicit `DROP` handles the `text`-vs-`void` return-type divergence the two Supabase projects could be on).
- A DB trigger function `parent_student_links_enforce_student_updates` constrains student-side updates: a student may only flip a `pending` link to `active`/`revoked` and can never reassign `parent_id`/`student_id`.
- On `pending`, the parent is redirected to `/parent/link-child?status=pending` and both sides are notified (`src/lib/parent/process-parent-link-notifications.ts`: approval request to the student, pending-approval notice to the parent; on `active`, linked/confirmed notices).
- Linking errors are mapped via `src/lib/auth/link-parent-rpc-errors.ts`; the action writes `parent_audit` rows on success, failure, and throttle, with Sentry counters `parent.link.success` / `parent.link.failure`.
- **Rate limits:** per-parent 10 attempts/hour and per-student-ref 5/15 min (`src/lib/parent/rate-limit.ts`), now **failing closed in prod** when the limiter store is degraded (`shouldDenyOnDegraded`, `src/lib/ratelimit/fail-policy.ts`, commit `accc7c8`). Parent **auth surfaces** (login / parent signup / password reset) gained app-level rate limiting too (`src/lib/auth/rate-limit.ts`, commit `26229c9`): account-first keying with hashed-email buckets so a shared school NAT IP isn't locked out, also fail-closed in prod.
- **Consent dimension:** `parental_consents` records DPDP-style guardian consent (`consentMethod`, `consentTextV`, `grantedAt`/`revokedAt`, `evidenceUrl`) — relevant for minors.

### 3.4 Data model — tables this portal reads/writes
| Table | Role in the parent portal |
|---|---|
| `profiles` | Parent record (`role='parent'`, `parentName`, `parentEmail`, `onboarding_welcome_seen_at`); also the linked child's profile (read). |
| `parent_student_links` | Parent↔child edges (`status` pending/active/revoked, `linkedAt`, `revoked_at`). Unique per (parent, student). The core authorization edge. |
| `parental_consents` | Guardian consent records for minors (method, version, granted/revoked, evidence). |
| `parent_audit` | Audit trail for every parent-side action (link success/failure/throttle, select-student, report-opened, unlink, notification-prefs). Inserts retried 3× (`src/lib/parent/audit.ts`). |
| `tests`, `test_reports`, `student_answers`, `questions` | The child's tests + graded reports + answered-question log the parent reviews (scoped to linked children). |
| `performance_tracker` | Per-(child, topic) mastery the parent dashboard visualises. Now also carries the review-schedule columns (`next_review_at`, `review_interval_days`, `review_ease`, `consecutive_good`; migration `20260704000000_review_schedule_phase1.sql`) that feed the advisory panel. |
| `doubt_conversations` / `doubt_messages` | The child's AI tutor history, surfaced as QnA/doubt oversight. |
| `assignments` / `assignment_submissions` | Teacher-set work + the child's completion status. Includes manual (teacher-authored) assignments (`authoringMode: "ai" \| "manual"`). |
| `subscriptions` / `usage_periods` / `payments` | Plan + quota + payment records the parent manages on the child's behalf. |
| `notifications` | Parent's in-app notifications (report ready, assignment, usage thresholds). Bell list + unread-count queries are now ordered index scans (composite + partial indexes, migration `20260703000000_notifications_recipient_created_indexes.sql`). |
| `user_preferences` | Parent's notification preferences (in-app/email toggles + per-type map), written by the parent settings actions. |

### 3.5 Routes (pages)
- `app/parent/link-child` — enter the child's code to link.
- `app/parent/select-student` — choose / switch the active child.
- `app/parent/open-report` — server redirect into a specific report.
- Under `app/parent/(portal)/`: `dashboard`, `performance`, `reports`, `qna-logs`, `doubt-chat`, `assignments`, `notifications`, `settings`, `subscription`.

### 3.6 Server actions & API routes
- **Linking/selection:** `link-child` action (+ RPC error mapping), `select-student/actions.ts` (cookie set + audit).
- **Settings actions** (refactored to server actions in `b1363d7`, matching the student settings patterns): `settings/actions.ts` (`updateParentProfile` — name/avatar/phone, avatar URL must be the caller's own Supabase storage object via `isOwnSupabaseAvatarUrl`), `settings/notification-preferences-actions.ts` (`updateParentNotificationPreferences` → `user_preferences` via Drizzle), `settings/unlink-actions.ts` (`unlinkParentFromStudent` → `unlink_parent_from_student` RPC, audited, clears the active-child cookie if it pointed at the unlinked child).
- **Advisory loader:** the parent performance page calls `loadAdvisoryActions` / `rankAdvisoryActions` (`src/lib/student/review-advisory.ts`) over the child's `performance_tracker` rows (RLS read; parent already link-verified).
- **Parent API** (`app/api/parent/`): `assignments/open-indicator`, `notifications` (+ `[id]`, `read-all`, `unread-count`), `qna-logs` (+ `[answerId]`, `nav`). The assignments **list** itself is rendered server-side (`listStudentAssignments` in `src/lib/assignments/queries.ts`), not via an API route.
- **Billing:** the parent can drive checkout/management for the child's `subscription` through the shared billing routes (`app/api/billing/**`).
- Entitlements for the active child are read via `getCachedEntitlementsForProfile(childProfileId)` (caller enforces the link).

### 3.7 Cross-cutting
- **Audit discipline:** all parent-side actions write `parent_audit` rows via the `PARENT_ACTIONS` registry (`src/lib/parent/audit-actions.ts`) — link success/failure/throttle, select-student (+ unauthorized attempts), report-opened, unlink, notification-prefs update. Inserts retry transient failures 3× and raise `parent_audit_retry_exhausted` in Sentry on exhaustion.
- **CI auth backstop:** `tests/api/user-routes-require-auth.test.ts` fails CI if any route under `app/api/parent/**` (or student/teacher) references none of the recognized auth entry points (architecture-review finding H5, commit `ac2df61`).
- **Notifications** mirror the student's important events to the parent.
- **Security:** `httpOnly` active-child cookie, server-side `assertParentActiveLink`, origin gating via `parentProxyGate`, rate limiting (fail-closed in prod).

---

## 4. Capabilities, feature by feature

### 4.1 Link to a child (and switch between children)
- **[Plain]** The parent enters the child's code once; from then on the child appears in their portal. If the child's account has no guardian email on file, the child first approves the request from their own app before the parent can see anything. Parents with several kids can switch between them with one tap. A parent can also unlink a child from settings.
- **[Technical]** `link-child` → `link_parent_to_student` RPC → `parent_student_links` (audited; status `active` on email match, `pending` when no guardian email — student confirms via `confirm_parent_link`/`reject_parent_link` in `app/student/settings`). `select-student` sets an `httpOnly` active-child cookie; every load re-verifies via `assertParentActiveLink`. Multi-child supported. Unlink (`unlinkParentFromStudent`) sets the link `revoked` and clears the cookie.

### 4.2 Progress dashboard & "what to focus on next"
- **[Plain]** A clear overview of how the child is doing across subjects — what's mastered, what's weak, and the direction of travel. The performance page also gives the parent a short, ranked list of what the child should work on next, so check-ins can be specific ("revise Algebra today") instead of vague.
- **[Technical]** `(portal)/dashboard` + `performance` read `performance_tracker` for the active child; charts via Recharts. The advisory panel (`src/components/parent/review-advisory-panel.tsx`, commit `1be55f7`, closed-learning-loop phase 4) renders `loadAdvisoryActions` output: overdue reviews first, then due-soon, then weak unscheduled topics (`average_score < 75`), capped at 5; mastered/unscheduled topics excluded; empty state "All caught up".

### 4.3 Read the child's reports
- **[Plain]** The parent can open any graded test the child took and read the score, the model answers, and the feedback — the same report the student gets.
- **[Technical]** `(portal)/reports` over `tests`+`test_reports`; deep-link via `open-report/route.ts`.

### 4.4 Oversee doubts & answered questions
- **[Plain]** Parents can review what the child has been asking the AI tutor and how they answered practice questions — useful for spotting struggles or misuse.
- **[Technical]** `(portal)/doubt-chat` + `qna-logs` read `doubt_conversations`/`doubt_messages` and `student_answers` for the active child, paginated with prev/next nav.

### 4.5 Track assignments
- **[Plain]** See what the teacher assigned and whether the child has done it (and on time) — including tests the teacher wrote by hand, not just AI-generated ones.
- **[Technical]** `(portal)/assignments` renders `listStudentAssignments` over `assignment_submissions` (status/score/`isLate`, `authoringMode: "ai" | "manual"` since the manual-assignment feature `7310a4f`); `app/api/parent/assignments/open-indicator` flags outstanding work.

### 4.6 Manage the subscription & payments
- **[Plain]** The parent can see how many tests and AI credits remain this period, upgrade the plan, and handle payment — taking the money side off the child. Pro currently costs ₹600/month or ₹6,000/year (two months free).
- **[Technical]** `(portal)/subscription` reads the child's entitlement snapshot (plan, `testsLeft`, `tokensLeft`, trial/status); checkout/management via Razorpay (`app/api/billing/**`). Records in `subscriptions`/`usage_periods`/`payments`. Pricing: `pro_monthly` 60,000 paise / `pro_annual` 600,000 paise (`src/lib/billing/plans.ts`, migration `20260531120000_update_student_plan_prices.sql`, commit `b1363d7`).

### 4.7 Notifications & settings
- **[Plain]** Get alerts (report ready, new assignment, nearing the monthly limit) and manage profile + notification preferences + linked children.
- **[Technical]** `(portal)/notifications` + API; `(portal)/settings` rebuilt on server actions + shared form patterns matching student settings (`parent-account-settings-form.tsx`, sections `parent-profile-editor-panel` / `link-student-section` / `switch-student-section`; the old `parent-account-settings-client.tsx` was removed). Prefs persist to `user_preferences`.

### 4.8 First-run onboarding tour
- **[Plain]** New parents get a short welcome and a guided walk through the sidebar (Overview, Learning chats, Assignments, Subject progress, Test reports) the first time they sign in; it can be replayed from the top bar.
- **[Technical]** `ParentOnboarding` (`src/components/onboarding/parent-onboarding.tsx`): `WelcomeDialog` + `CoachMarks` keyed by `data-onboarding-id` on nav items (`src/components/parent/parent-nav-main.tsx`). Gated by `profiles.onboarding_welcome_seen_at` + a 30-day `created_at` window in `(portal)/layout.tsx`; replay via `subscribeTourReplay`.

---

## 5. How the Parent Portal benefits the parent — [Plain]

- **Visibility without nagging.** Instead of asking "did you study?", the parent sees actual evidence — tests taken, scores, trends, weak topics — and can have a more useful conversation.
- **Confidence the time is well spent.** The content is NCERT-aligned and the AI tutor is safety-screened and kept on-syllabus, so the parent knows their child is using a genuine study tool.
- **One place to handle money.** Plans, usage, and payments are managed by the adult, not the child.
- **Early warning.** Notifications about weak performance, missed assignments, or low remaining credits let a parent step in before small problems grow.
- **Works for the whole family.** One parent account can follow multiple children.
- **Potential savings.** Effective at-home practice and doubt-clearing can reduce reliance on paid tuition.

---

## 6. How the Parent Portal benefits everyone else — [Plain]

**Students**
- A supportive, informed parent (rather than an anxious, in-the-dark one) usually means less pressure and better help at home.
- The student keeps ownership of their learning; the parent observes rather than takes over.

**Teachers**
- Parents who can see progress and assignments reinforce the teacher's plan at home, improving completion and follow-through.
- Shared, objective data reduces friction in parent-teacher conversations.

**Schools & coaching institutes**
- Parent engagement is a strong signal of value and a driver of retention and referrals for the institute.

**The business (24Vertex)**
- Parents are typically the **bill-payers**, so a clear, reassuring parent experience directly supports conversions and renewals.
- Consent records (`parental_consents`) and scoped, audited access help the platform meet data-protection expectations for minors — reducing regulatory and reputational risk.

**Trust & safety / compliance (internal)**
- The parent link is the mechanism that ties a guardian to a minor's account, underpinning DPDP-style consent and the admin's compliance tooling.

---

## 7. Honest limitations & current edges — [Technical]

- **Parent-linking blank-`parent_email` hazard: resolved, regressed, re-resolved.** The confirmation gate (`20260525150000`) was silently overwritten by the rebrand migration `20260621130000_vertex24_bypass_profile_guard.sql` (unconditional `active` link + guardian back-fill) and restored by `20260706000000_restore_parent_link_confirmation_and_harden_admin_rpcs.sql` (commit `dca4d20`). The restore is idempotent, but the migration header itself warns the two Supabase projects can hold **divergent versions** of `link_parent_to_student` — confirm the restore is applied to BOTH projects (fingerprint `pg_catalog`, don't trust the migration ledgers).
- **Pending links have no lifecycle management**: no expiry, reminder, or cleanup for stale `pending` rows a student never confirms or rejects.
- The **advisory panel depends on the review scheduler's rollout**: `next_review_at` only populates for students covered by the closed-learning-loop phases (kill-switch + staged cohort gate `review_scheduler_rollout_pct`/`cohort_org_ids`, commit `c264f1d`). For children outside the cohort the panel degrades to weak-topic suggestions or "All caught up", indistinguishable from a genuinely caught-up child.
- The advisory load has **no dedicated telemetry** (no Sentry span/metric around `loadAdvisoryActions` on the parent page).
- The active-child cookie max-age is **90 days** (`select-student/actions.ts` + `open-report/route.ts`); access is re-checked server-side via `assertParentActiveLink`, and the cookie is now cleared on unlink.
- Two `PARENT_ACTIONS` audit names are **declared but never written** anywhere: `LINK_CHILD_REQUEST` and `REPORT_DOWNLOAD` (`src/lib/parent/audit-actions.ts`) — wire them up or remove them.
- The parent view is **read-oriented**: parents cannot author or take tests, edit the child's answers, or message teachers in-portal (by design). The advisory panel is likewise display-only — the parent can't trigger a review test for the child.

---

## 8. PDR-style specification — current code state (for LLM planning)

> **How to read this section.** Mirrors the canonical *Product Design Requirements* (PDR v3.0, referenced inline as `PDR §x.y`). Parent linking is core PDR (`supabase/migrations/...eduai_parent_linking.sql`); guardian consent intersects compliance **PDR §4.23**. Each requirement has a local ID (`PAR-R#`), a **Status** in `[BRACKETS]`, file **evidence**, and (for gaps) a **Hook:** pointer.
> **Status legend:** `[IMPLEMENTED]` · `[PARTIAL]` · `[GAP]` · `[PLANNED]`.

### 8.1 Entity state machines

**Parent↔child link** (`parent_student_links.status`, persisted `src/db/schema/profiles.ts`; authoritative RPCs in `20260706000000_restore_parent_link_confirmation_and_harden_admin_rpcs.sql`)
```
(parent submits child's 8-char studentLinkCode OR student UUID)
        │  link_parent_to_student(p_student_ref) → returns status text
        ├─ student has guardian parent_email AND it == parent's auth email ──▶ active (linkedAt)
        ├─ guardian parent_email on file but ≠ parent's auth email ──▶ ERROR (no row written)
        └─ no guardian parent_email on file ──▶ pending  (guardian fields NOT back-filled)
                 pending ──confirm_parent_link(link_id) [student-only; back-fills
                           profiles.parent_email/parent_name, sets linkedAt]──▶ active
                 pending ──reject_parent_link(link_id) [student-only]──▶ revoked (linked_at NULL)
active ──unlink_parent_from_student(p_student_id) [parent, from settings]──▶ revoked (revoked_at)
re-link upsert: ON CONFLICT(parent_id, student_id) an 'active' row stays active;
                a 'pending'/'revoked' row is refreshed to the newly computed status
INVARIANT: unique(parent_id, student_id)
INVARIANT: trigger parent_student_links_enforce_student_updates — a student may only flip
           pending→active or pending→revoked and can never reassign parent_id/student_id
AUTH: every parent page re-checks the active edge server-side via assertParentActiveLink
      (the active-child cookie is convenience, NOT the authority)
HISTORY: the confirmation gate (20260525150000) was overwritten by the rebrand migration
      20260621130000_vertex24_bypass_profile_guard (unconditional active + guardian back-fill)
      and restored as the authoritative definition by 20260706000000 (commit dca4d20, finding M1).
```

**Active-child selection** (httpOnly cookie, `app/parent/select-student/actions.ts`)
```
no selection ──▶ selected(childId)  (cookie set; rotated on each select)
re-validated each load by assertParentActiveLink; revoked link ⇒ rejected next load
```

**Guardian consent** (`parental_consents`, PDR §4.23)
```
(none) ──▶ granted (grantedAt, consentMethod, consentTextV, evidenceUrl)
granted ──▶ revoked (revokedAt)
```

### 8.2 Functional requirements & current status

| ID | Requirement | Status | Evidence | PDR |
|---|---|---|---|---|
| PAR-R1 | Parent links to a child using the child's 8-char `studentLinkCode` (or student UUID); relationship audited. | `[IMPLEMENTED]` | `app/parent/link-child`, `link_parent_to_student` RPC, `parent_student_links`, `link-parent-rpc-errors.ts` | core |
| PAR-R2 | Parent may link multiple children and switch the active child. | `[IMPLEMENTED]` | `select-student/actions.ts` (httpOnly cookie) | core |
| PAR-R3 | All access to a child's data re-verified server-side per request. | `[IMPLEMENTED]` | `assertParentActiveLink` | core |
| PAR-R4 | Read child's performance, reports, answered-question log, doubt history. | `[IMPLEMENTED]` | `(portal)/{performance,reports,qna-logs,doubt-chat}` over `performance_tracker`/`tests`/`test_reports`/`student_answers`/`doubt_*` | core |
| PAR-R5 | Track assignments + completion/late state (incl. manual teacher-authored). | `[IMPLEMENTED]` | `(portal)/assignments` via `listStudentAssignments`, `app/api/parent/assignments/open-indicator` | core |
| PAR-R6 | Manage child's subscription/plan/payments and see remaining quota. | `[IMPLEMENTED]` | `(portal)/subscription`, `getCachedEntitlementsForProfile`, `app/api/billing/**` | core |
| PAR-R7 | Notifications mirror the child's key events; manage profile/notif prefs/linked children. | `[IMPLEMENTED]` | `(portal)/notifications` + API, `(portal)/settings` | core |
| PAR-R8 | Guardian consent recorded for minors (DPDP-style). | `[IMPLEMENTED]` | `parental_consents` | §4.23 |
| PAR-R9 | Block link auto-fill when student `parent_email` is blank; require student confirmation. | `[IMPLEMENTED]` | **Restored** by `20260706000000_restore_parent_link_confirmation_and_harden_admin_rpcs.sql` after the rebrand migration `20260621130000` had regressed it to unconditional `active`; student-side trigger `parent_student_links_enforce_student_updates`; confirm/reject UI in `app/student/settings/parent-link-actions.ts` | core (security) |
| PAR-R10 | Bounded active-child cookie max-age + server re-check. | `[IMPLEMENTED]` | 90 days (`select-student/actions.ts`, `open-report/route.ts`); `assertParentActiveLink` re-checks each load; cookie cleared on unlink (`settings/unlink-actions.ts`) | core (security) |
| PAR-R11 | Audit `parent.student_selected` / `parent.report_opened`. | `[IMPLEMENTED]` | `PARENT_ACTIONS.SELECT_STUDENT` / `SELECT_STUDENT_UNAUTHORIZED` (`select-student/actions.ts`), `REPORT_OPENED` (`open-report/route.ts`), `UNLINK_CHILD`, `LINK_CHILD_THROTTLED` → `parent_audit` | core (observability) |
| PAR-R12 | Origin/CSRF gate on mutating `/api/parent/*`; link-code normalisation; `.strict()` schemas. | `[IMPLEMENTED]` | `parentProxyGate` (`src/lib/parent/proxy-guard.ts`); `linkParentSchema` is `.strict()` + upper-cases codes (and the RPC upper-cases in-DB); `parentProfileUpdateSchema` and `notificationPreferencesPayloadSchema` are `.strict()` | core (security/validation) |
| PAR-R13 | Parent is read/oversight only — cannot take tests, edit answers, or author content. | `[IMPLEMENTED]` (by design) | scope of `app/parent/**` | core |
| PAR-R14 | Advisory "what to focus on next" panel on the parent performance page: ranked overdue → due-soon → weak, capped at 5. | `[IMPLEMENTED]` | `src/components/parent/review-advisory-panel.tsx`, `loadAdvisoryActions`/`rankAdvisoryActions` (`src/lib/student/review-advisory.ts`) over `performance_tracker` review-schedule columns | loop phase 4 |
| PAR-R15 | Parent-link and parent auth-surface rate limiters fail **closed** in prod when the limiter store is degraded. | `[IMPLEMENTED]` | `shouldDenyOnDegraded` (`src/lib/ratelimit/fail-policy.ts`) in `src/lib/parent/rate-limit.ts` + `src/lib/auth/rate-limit.ts` (login/signup/reset, account-first hashed-email keying) | core (security) |
| PAR-R16 | `open-report` verifies the test belongs to the linked student before auditing/redirecting. | `[IMPLEMENTED]` | ownership check in `app/parent/open-report/route.ts` (commit `e216a70`, L8) | core (security) |
| PAR-R17 | First-run parent onboarding (welcome dialog + sidebar coach-marks, replayable), shown once. | `[IMPLEMENTED]` | `src/components/onboarding/parent-onboarding.tsx`, `profiles.onboarding_welcome_seen_at` (`20260704040000`), 30-day window gate in `(portal)/layout.tsx` | UX |
| PAR-R18 | Parent settings via validated server actions: profile (name/avatar/phone with avatar-ownership check), notification prefs, unlink. | `[IMPLEMENTED]` | `settings/actions.ts`, `settings/notification-preferences-actions.ts`, `settings/unlink-actions.ts`; prefs in `user_preferences` | core |
| PAR-R19 | CI backstop: every `/api/parent/**` route must reference a recognized auth entry point. | `[IMPLEMENTED]` | `tests/api/user-routes-require-auth.test.ts` (finding H5, commit `ac2df61`) | core (security/CI) |

### 8.3 Data contracts & invariants (enforced)
- **One link row per (parent, student)** — `unique(parent_id, student_id)` on `parent_student_links`; the upsert in `link_parent_to_student` never downgrades an `active` row.
- **Link RPC return contract** — `link_parent_to_student` returns `'active' | 'pending'` as text; the action branches the redirect (`/parent/dashboard` vs `/parent/link-child?status=pending`) and the notification fan-out on it.
- **Student-side mutation guard** — trigger `parent_student_links_enforce_student_updates`: a student can only activate/reject a `pending` link and never reassign link endpoints.
- **Unlink** — `unlink_parent_from_student` sets `status='revoked'` + `revoked_at` (rows are kept for forensics, not deleted); the action clears the active-child cookie when it pointed at the unlinked child.
- **Server-authoritative access** — child-scoped reads gate on a live `active` link, not on the cookie.
- **Entitlements for a non-self profile** — `getCachedEntitlementsForProfile(childId)` requires the caller to have proven the link first.
- **UUID-validated deep links** — `open-report/route.ts` validates `studentId`/`testId` as UUIDs **and** verifies the test belongs to the linked student before redirect.
- **Advisory action shape** — `AdvisoryAction { topicId, topicName, reason: 'overdue'|'due_soon'|'weak', dueInDays }`, max 5, weak threshold `average_score < 75`, ranked overdue → due-soon → weak (`rankAdvisoryActions`, unit-tested in `src/lib/student/__tests__/review-advisory.test.ts`).
- **Audit durability** — `writeParentAudit` retries transient insert failures up to 3×; exhaustion raises `parent_audit_retry_exhausted` in Sentry.

### 8.4 Telemetry & observability
- Linking writes audit rows AND Sentry counters `parent.link.success` / `parent.link.failure` (tagged with the failure `reason`) — the success/failure ratio metric formerly listed as a gap exists in `app/parent/link-child/actions.ts`.
- Sentry spans: `parent.performance.prepare` (`(portal)/performance/page.tsx`), `parent.unlink_child` (`settings/unlink-actions.ts`).
- Loop phase 4 before/after telemetry: graded review tests emit a `review_test_completed` event (`src/lib/practice/analytics.ts`, commit `07d0ba0`) — student-side, but it is the measurement backend for what the parent advisory recommends.
- `[GAP]` no span/metric around the parent advisory load itself.

### 8.5 Known gaps & next-step hooks (ordered by risk)
1. **PAR-R9 dual-project parity** — the restore migration (`20260706000000`) is idempotent precisely because the two Supabase projects could hold divergent `link_parent_to_student` definitions (`text` vs `void` return). **Hook:** fingerprint `pg_catalog` on dev (`ezxmjkvhrlqeimhnfvfd`) and prod (`suwakggcbxmmvqzeudmq`) to confirm both run the restored definition; don't trust the migration ledgers.
2. **Pending-link lifecycle** — no expiry/reminder/cleanup for stale `pending` links the student never acts on. **Hook:** a nightly sweep (cf. the review-scheduler `pg_cron` pattern) that nudges the student or expires the row after N days.
3. **Declared-but-unwritten audit actions** — `PARENT_ACTIONS.LINK_CHILD_REQUEST` and `REPORT_DOWNLOAD` are defined in `src/lib/parent/audit-actions.ts` but never written. **Hook:** wire them (request-side audit on every link attempt; download audit on report export) or delete them.
4. **Advisory observability + rollout disambiguation** — no telemetry on `loadAdvisoryActions` from the parent page, and the "All caught up" empty state can't be distinguished from "child's cohort not in the review-scheduler rollout" (`review_scheduler_rollout_pct` / `cohort_org_ids`, `20260704030000_review_scheduler_cohort.sql`). **Hook:** a Sentry span + an explicit empty-state variant when the child has no scheduled rows.
