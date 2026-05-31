# 24Vertex — Admin Portal

**Snapshot:** 2026-05-31 · branch `claude/festive-goldberg-e79b4b` @ `8f69969`. The §8 status tags were re-verified against current code on this date (superseding the older `docs/audit/*` snapshot of 2026-05-17 — several P0/P1 items it flagged are now resolved).
**Product:** 24Vertex (technical slug `vertex24`; legacy `eduai`)
**Audience for this doc:** mixed. **[Plain]** sections are for any human reader (operators, support, business). **[Technical]** sections are dense and name concrete files, tables, routes, and flows for engineers and LLMs.
**Scope:** `app/admin/**`, `app/api/admin/**`, `app/api/internal/**`, `src/lib/admin/**`.

---

## 1. What the Admin Portal is — [Plain]

The Admin Portal is the control room of 24Vertex. It is the staff-only back office that keeps everything else running. From here the team can:

- **Manage every user** (students, parents, teachers) — view, suspend, impersonate for support, delete.
- **Approve teachers** and manage schools/institutes (organizations).
- **Maintain the curriculum** — the subjects, chapters, topics, and the reference text the AI uses.
- **Run and tune the AI** — edit prompts, watch usage and costs, moderate content.
- **Oversee assessments** — see live tests, extend time, pause, regrade, void.
- **Run the business** — plans, coupons, subscriptions, payments, refunds, billing reconciliation.
- **Communicate** — send broadcasts and emails, manage templates.
- **Handle compliance** — parental consent, data export/erasure requests, retention.
- **Operate the system** — health checks, background jobs, integrity checks, and a guarded SQL console.
- **Audit everything** — a log of who did what.

It is powerful and sensitive, so it has its own, stricter security stack — separate from how students/parents/teachers log in.

---

## 2. How the Admin Portal fits the wider platform — [Plain]

Everyone else consumes the platform; admins **supply and govern** it:

- They feed the **curriculum** and reference content the AI uses to write questions.
- They **approve teachers** before teachers can touch student data.
- They keep the **AI, billing, email, and safety** systems healthy.
- They step in when something goes wrong — a stuck test, a payment mismatch, a safety flag, a data-deletion request.

If the other three portals are the building, the admin portal is the facilities, security, and management office.

---

## 3. Current technical setup — [Technical]

### 3.1 Stack and where it lives
Same base platform (Next.js 16 App Router, Supabase Postgres, Drizzle, Tailwind v4 + shadcn/Radix, Recharts, Vercel, Sentry, Upstash). Admin UI under `app/admin/**` and `src/components/admin/**` (shell/sidebar at `src/components/admin/shell/sidebar.tsx`); server logic under `src/lib/admin/**`. Admin pages are served `noindex,nofollow`.

### 3.2 Authentication — a separate, hardened stack
Admins do **not** use Supabase Auth. The custom stack:
- **Credentials:** bcrypt password hash (`bcryptjs`) + **TOTP** (`otplib`) two-factor. Login core `src/lib/admin/login-core.ts`, `auth.ts`, `totp.ts`.
- **Sessions:** signed JWTs via `jose` (`src/lib/admin/jwt-edge.ts`), stored/tracked in `admin_sessions`; short-TTL in-process cache (`api-auth.ts`).
- **Network controls:** IP allowlist (`ip-allowlist.ts`), login rate limiting (`admin-login-rate`, `login-rate-limit.ts`).
- **Panic revoke:** `app/api/admin/panic` bumps `jwt_version`/runtime KV to invalidate all admin tokens.
- **Step-up:** the writable SQL console requires a fresh TOTP code.
- **Routes:** `app/admin/login`, `app/api/admin/auth/{login,logout,session}`. Protected pages live under `app/admin/(authenticated)/` with `layout.tsx` + `loading.tsx`.

### 3.3 Admin sections (navigation)
Under `app/admin/(authenticated)/`: `dashboard`, `users`, `organizations`, `curriculum`, `assessments`, `ai`, `analytics`, `performance`, `billing`, `communications`, `compliance`, `audit`, `system`.

### 3.4 Data model — admin-specific & governed tables
*(Drizzle definitions in `src/db/schema/`. Admins also read/write most application tables described in the other portal docs.)*

| Table | Purpose |
|---|---|
| `admin_sessions` | Active admin JWT sessions (revocable). |
| `admin_login_rate` | Admin login attempt throttling. |
| `admin_runtime_kv` | Runtime key/value (e.g. panic/jwt-version, feature toggles). |
| `admin_saved_views` | Saved filters/views for admin lists. |
| `admin_action_log` | Audit trail of admin actions (actor, target, before/after). |
| `feature_flags` | Server-driven feature gating. |
| `ai_prompts` | Versioned, activatable AI prompts (edit + test + activate). |
| `ai_calls` | Per-AI-call telemetry (tokens, model, cost). |
| `topic_context_chunks` | RAG reference text per topic that grounds generation. |
| `moderation_flags` / `content_blacklist` | Safety review queue + banned-content rules. |
| `broadcasts` / `email_templates` / `email_webhook_events` / `comms_audit` | Messaging: campaigns, templates, delivery webhooks, comms audit. |
| `compliance_requests` / `parental_consents` / `retention_policies` | DPDP-style data export/erase requests, guardian consent, retention. |
| `operator_jobs` | Generic admin/background job queue. |
| `integrity_check_results` / `service_health_pings` | Data-integrity checks + provider health monitoring. |
| `teacher_approval_history` | Teacher verification transitions. |
| `user_feedback_reports` | User-submitted feedback/bug reports. |
| Billing set (`plans`, `subscriptions`, `usage_periods`, `payments`, `coupons`, `coupon_redemptions`, `billing_events`, `billing_plan_changes`, `billing_reconciliation_drift`, `billing_action_failures`, `quota_grants`, `free_trial_claims`, `identity_blocklist`) | Full SaaS billing surface (see §3.7). |

### 3.5 API surface (overview)
`app/api/admin/**` is the largest API area in the codebase (~130+ handlers). Major groups: `users`, `teachers`, `organizations`, `subjects`/`topics`/`context-chunks` (curriculum), `tests` (assessments), `ai/prompts`/`ai/usage`, `analytics`, `performance`, `billing`/`payments`/`plans`/`coupons`/`subscriptions`/`grants`, `broadcasts`/`email-templates`/`email-log`, `compliance`, `moderation`, `audit`, `system` (`health`, `integrity`, `sql`), `feedback`, `saved-views`, `search`, `dashboard`, `sessions`, `trial-claims`, `panic`, `jobs`. Internal cron/worker endpoints live under `app/api/internal/**` (billing reconcile/dunning/trial-emails, practice auto-submit/run-jobs/metrics, compliance-retention, health-pings, integrity-checks, weekly-digest, doubt-chat cleanup).

### 3.6 Curriculum & AI governance
- **Curriculum:** subjects/topics CRUD (`topics/bulk`, `topics/clone-to-grade`, `subjects/reorder`), and `context-chunks` (the `topic_context_chunks` RAG source). Import tooling in `src/lib/admin/import/`. (The repo also ships skills `topics-creator`, `topic-context-creator`, `topics-questions-chunks` that turn NCERT/question-bank PDFs into importable CSVs.)
- **AI:** `ai/prompts` (versioned prompts editable in a Monaco editor, with `test` and `activate`), `ai/usage` over `ai_calls`, moderation queue (`moderation/flags`, `moderation/blacklist`). Prompt store `src/lib/ai/prompt-store.ts`.

### 3.7 Billing & operations
- **Plans/coupons:** plans (`plans/[code]/sync-razorpay`), coupons (`coupons/bulk-generate`, `[code]/sync-razorpay-offers`, redemptions).
- **Subscriptions:** rich lifecycle ops (`change-plan`, `cancel-now`/`cancel-at-period-end`, `pause`/`resume`, `force-renew`, `apply-coupon`, `staff-override`, `recompute-usage`, `grants`). Logic in `src/lib/billing/subscription-*` + `src/lib/admin/billing/`.
- **Payments:** view + `refund` (idempotent via `admin_refund_idempotency`).
- **Reconciliation:** `billing/events/[id]/replay`, `reconciliation/[id]/resolve`, `action-failures/[id]/{retry,resolve}` — keep local state in sync with Razorpay (`billing_reconciliation_drift`, `billing_action_failures`, `billing_events`).
- **Jobs:** `jobs`/`jobs/queues` (pause/resume), `jobs/[id]` (retry/cancel/promote), schedules — over `operator_jobs`.

### 3.8 Assessments operations
`app/api/admin/tests/**`: `live` (in-flight tests), `[id]` view, `extend` (timer), `pause`/`resume`, `force-submit`, `regrade`, `void`, `refund-credit`, `message` (push a message into a live test via `admin_test_messages`), `answers`. These manipulate `tests`/`student_answers` integrity fields (`isPaused`, `adminExtensions`, `accumulatedPauseSeconds`).

### 3.9 Compliance, audit & system
- **Compliance:** `compliance/requests/[id]/{export,erase,reject,verify-identity}` (DPDP subject-rights), `consents/[studentId]/{request,revoke}`, `retention/[entity]/run-now`. Anonymisation in `src/lib/admin/anonymize.ts`.
- **System:** `system/health/[provider]/check` (`service_health_pings`), `system/integrity/checks/[name]/{run,fix}` (`integrity_check_results`), and the **SQL console** `system/sql/run` (read-only by default; writable mode requires fresh TOTP + table allowlist + per-verb gate + audited statement hash; parser in `src/lib/admin/sql/read-only.ts`).
- **Users:** `[id]/{suspend,unsuspend,soft-delete,hard-delete,revoke-sessions,impersonate}` — impersonation lets support reproduce a user's view.
- **Audit:** `admin_action_log` records actor/target/before-after for admin writes.

---

## 4. Capabilities, feature by feature

### 4.1 Sign in securely (2FA + IP + panic)
- **[Plain]** Staff log in with a password and a 6-digit authenticator code, only from approved networks, and a single "panic" button can instantly log out every admin if something looks wrong.
- **[Technical]** bcrypt + TOTP + `jose` JWT + IP allowlist + login rate limit; `panic` bumps the token version. Writable SQL needs a fresh TOTP.

### 4.2 Manage users
- **[Plain]** Search any user, view their full profile and activity, suspend or delete them, reset their sessions, or temporarily "see what they see" to help with a support ticket.
- **[Technical]** `users` list + `[userId]` detail (multi-tab) → suspend/unsuspend, soft/hard delete, revoke-sessions, impersonate. Writes audited to `admin_action_log`.

### 4.3 Approve teachers & manage organizations
- **[Plain]** Review teacher sign-ups and approve, reject, or ask for more info; create schools/institutes and hand out their join codes.
- **[Technical]** `teachers/pending` + `[id]/{approve,reject,request-info}` (→ `teacher_approval_history`); `organizations` CRUD (incl. `linkingCode`, favicon).

### 4.4 Maintain curriculum & reference content
- **[Plain]** Keep the list of subjects, chapters, and topics correct for every grade, and manage the textbook-style reference text the AI reads when it writes questions.
- **[Technical]** subjects/topics CRUD (+ bulk, clone-to-grade, reorder); `context-chunks` over `topic_context_chunks`; PDF→CSV import skills feed this.

### 4.5 Tune & monitor the AI
- **[Plain]** Edit the instructions that drive the AI, test a change before making it live, and watch how much the AI is being used and what it costs.
- **[Technical]** `ai/prompts` (versioned, Monaco editor, test + activate), `ai/usage` over `ai_calls`; moderation queue + blacklist.

### 4.6 Operate live assessments
- **[Plain]** See tests happening right now and intervene fairly — extend time, pause, force-submit, regrade, void a broken test, refund a credit, or send a note to a student mid-test.
- **[Technical]** `tests/live` + `tests/[id]/{extend,pause,resume,force-submit,regrade,void,refund-credit,message,answers}`; manipulates integrity fields + `admin_test_messages`.

### 4.7 Run the business (billing)
- **[Plain]** Manage plans and discount coupons, change/cancel/pause subscriptions, issue refunds, hand out free grants, and fix any mismatch between our records and the payment provider.
- **[Technical]** plans/coupons/subscriptions/payments/grants ops + reconciliation (events replay, drift/action-failure resolution) against Razorpay.

### 4.8 Communicate with users
- **[Plain]** Build and send announcements and emails to chosen audiences, with templates and previews, and see delivery results.
- **[Technical]** `broadcasts` (preview/test/schedule/send, audience filters), `email-templates` (preview/test/activate), `email-log` + suppressions, Resend webhooks (`comms_audit`, `email_webhook_events`).

### 4.9 Compliance & data rights
- **[Plain]** Honour legal requests — export or erase a user's data, verify identity first, manage parental consent for minors, and enforce how long data is kept.
- **[Technical]** `compliance/requests/[id]/{verify-identity,export,erase,reject}`, `consents/[studentId]/{request,revoke}`, `retention/[entity]/run-now`; anonymisation helpers.

### 4.10 System health, jobs & SQL
- **[Plain]** Check that all the external services are up, run data-integrity checks (and auto-fix some), manage background jobs, and — carefully — run database queries for deep support.
- **[Technical]** `system/health`, `system/integrity` (run/fix), `jobs`/queues, and the guarded `system/sql/run` console (read-only default; writable = TOTP + allowlist + audit).

### 4.11 Analytics, performance & audit
- **[Plain]** See top-level metrics, funnels and cohorts, recompute a student's performance if needed, and review a complete log of admin actions.
- **[Technical]** `analytics/{overview,funnel,cohorts,export}`, `performance/[studentId]/{recalculate,reinitialize}` + bulk reinit jobs, `audit` over `admin_action_log`; saved views + global `search`.

---

## 5. How the Admin Portal benefits the admin / operator — [Plain]

- **One control room for everything.** Users, content, AI, money, messaging, compliance, and system health are all reachable from a single, role-secured place.
- **Fast, safe support.** Impersonation, live-test controls, and the SQL console let staff diagnose and fix real user problems quickly — without guesswork.
- **Confidence to act.** Strong auth (2FA, IP allowlist, panic), audited actions, and step-up checks mean operators can use powerful tools without fear of silent mistakes.
- **Operational resilience.** Health checks, integrity checks, job controls, and billing reconciliation turn "something's wrong" into a concrete, fixable signal.
- **Governance built in.** Compliance tooling and audit logs make it possible to meet legal obligations and prove what happened.

---

## 6. How the Admin Portal benefits everyone else — [Plain]

**Students**
- The curriculum stays accurate and the AI stays well-tuned and safe, so the questions and tutoring students get are correct and on-syllabus.
- When a test breaks or time runs short unfairly, an admin can extend, regrade, void, or refund — protecting the student from being penalised for a glitch.

**Parents**
- Their data-protection rights (consent, export, erasure) are actually enforceable, and a real human can resolve billing or account issues.
- Safety moderation means the environment their child uses is actively monitored.

**Teachers**
- Teacher approval and organization management give teachers a trustworthy, verified space to work in.
- If a teacher hits a problem (a stuck assignment, a wrong roster), admins can investigate and fix it.

**Schools & coaching institutes**
- Organization and billing controls let institutes onboard cleanly and be supported as paying customers.

**The business (24Vertex)**
- Billing reconciliation, dunning, coupons, and plan management protect and grow revenue and keep financial records correct.
- Communication tools drive activation, retention, and announcements.
- AI cost/usage visibility keeps unit economics under control.

**Trust, safety & regulators**
- Moderation, audit logging, consent records, and retention enforcement reduce legal and reputational risk and demonstrate accountability.

---

## 7. Honest limitations & current edges — [Technical]

- **Previously highest-risk paths are now hardened:** the read-only SQL console uses a real tokenizer (`sql/read-only.ts`) that rejects CTE-with-DML / multi-statement / forbidden keywords, AND the run route executes `SET TRANSACTION READ ONLY` (`system/sql/run/route.ts:~303`); the admin JWT now supports `kid`-based key rotation (`auth.ts:20-44`; panic picks the next `ADMIN_JWT_SECRET_vN`). Remaining nuance to confirm: in-process session-cache invalidation on logout across HA nodes.
- The **plaintext `ADMIN_PASSWORD` fallback is now blocked in production** (`auth.ts:143` returns false when `NODE_ENV==='production'`); prod must use `ADMIN_PASSWORD_HASH_B64` (bcrypt).
- **Step-up reauth** is enforced for writable SQL but not for every sensitive action (e.g. mass deletes, teacher de-verification).
- **Per-route automated test coverage** of the ~130+ admin handlers is thin; the SQL read-only parser especially warrants table-driven tests.
- Heavy client deps (Monaco editor, Recharts) and missing parallelisation affect some admin pages' performance.
- See `docs/audit/admin-portal.md` and `docs/admin/ops-readiness.md` for the full, current punch list.

---

## 8. PDR-style specification — current code state (for LLM planning)

> **How to read this section.** The admin portal maps **directly** onto the canonical *Product Design Requirements* (PDR v3.0), which the code references inline as `PDR §x.y`. The admin panel was built in numbered **phases**, each a migration that implements a PDR section. Each requirement has a local ID (`ADM-R#`), a **Status** in `[BRACKETS]`, file **evidence**, and (for gaps) a **Hook:** pointer.
> **Status legend:** `[IMPLEMENTED]` · `[PARTIAL]` · `[GAP]` · `[PLANNED]`.

### 8.0 Build-phase → PDR-section map (ground truth from migrations)
| Phase / migration | PDR | Delivers |
|---|---|---|
| Phase 1 `20260502120000_admin_panel_phase1.sql` | §6 | profiles augment (item 1), `admin_action_log` append-only (item 2, immutability), `admin_sessions` (item 3), `feature_flags` (item 5) |
| Phase 3 `20260504140000_admin_phase3_assessments_live.sql` | §4.28 | `tests` live-session + pause accounting |
| Phase 5 `20260505120000_admin_phase5_communications_ai.sql` | §6 / §4.14 | `ai_prompts` + `ai_calls`, `broadcasts` (§4.14), `email_templates` |
| Phase 7 `20260510120000_admin_phase7_compliance.sql` | §4.23 | `compliance_requests`, `parental_consents`, `retention_policies` |
| Phase 8 `20260515130000_admin_phase8_operational.sql` | §4.25/§4.27/§4.29/§4.30 | dashboard metrics + job queues (§4.25), moderation (§4.27), `service_health_pings` (§4.29), `integrity_check_results` (§4.30) |
| Core PDR `20260412000001/2_eduai_pdr_v3_*` | §3–§5 | core data model + RLS + RPCs |
| (cross-cutting) | §3.3 | command palette (jumps = navigation-only; actions confirm) |
| (cross-cutting) | §5.4 | weekly operator digest (`src/lib/admin/digest/weekly.ts`) |

### 8.1 Entity state machines

**Admin session** (`admin_sessions` + `jwt_version` in `admin_runtime_kv`)
```
login (bcrypt + TOTP + IP allowlist + rate-limit) ──▶ active (jose JWT, jti in admin_sessions)
active ──(logout)──▶ revoked        [verify: in-process session-cache invalidation across HA nodes]
active ──(panic /api/admin/panic)──▶ ALL revoked (bump jwt_version)
active ──(TTL elapse)──▶ re-validated against DB
writable SQL / sensitive ops ──require fresh TOTP (step-up)──▶ allowed
```

**Compliance request — `compliance_requests.status`** (PDR §4.23)
```
open ──(verify-identity)──▶ identity_verified=true ──▶ in_progress
  ├──(export)──▶ fulfilled  (evidenceUrl = ZIP of JSON slices; export-user-data.ts)
  ├──(erase) ──▶ erased     (anonymize.ts / erasure.ts)
  └──(reject)──▶ rejected
dueAt = statutory deadline (due-at.ts); alerts.ts pings Sentry near/over deadline
```

**Live-test operator actions** (PDR §4.28 — orthogonal mutations on a student's `tests` row)
```
extend(+time) · pause/resume(isPaused, accumulatedPauseSeconds) · force-submit ·
regrade · void · refund-credit · message(admin_test_messages)
each writes admin_action_log; tabBlur/speed anomalies surfaced (anomalies.ts, §4.7)
```

**Operator job — `jobs.status`** (PDR §4.25; table `jobs`, `operator-jobs.ts`)
```
queued ──▶ running ──▶ done
                  └──▶ failed (attempts++ ≤ maxAttempts; error)
controls: pause/resume queue · retry/cancel/promote job
processor: /api/internal/admin/process-operator-jobs
```

**Billing webhook event — `billing_events`** (Razorpay)
```
received (razorpay_event_id UNIQUE = idempotency) ──▶ processed
                                                  └──▶ error ──(replay)──▶ processed (replayCount++)
drift detected ──▶ billing_reconciliation_drift ──(resolve)──▶ resolved
processing failure ──▶ billing_action_failures ──(retry/resolve)──▶ resolved
```

**Subscription admin transitions** (`subscription-state-machine.ts`, `subscription-admin-transitions.ts`)
```
change-plan (immediate|period-end, proration) · cancel-now · cancel-at-period-end (+clear) ·
pause/resume (pre-pause quota snapshot) · force-renew · apply-coupon · staff-override · recompute-usage
all recorded in billing_plan_changes / payments / audit
```

### 8.2 Functional requirements & current status

| ID | Requirement | Status | Evidence | PDR |
|---|---|---|---|---|
| ADM-R1 | Separate hardened admin auth: bcrypt + TOTP 2FA + IP allowlist + login rate-limit + panic revoke. | `[IMPLEMENTED]` | `login-core.ts`, `auth.ts`, `totp.ts`, `ip-allowlist.ts`, `jwt-edge.ts`, `/api/admin/panic` | §6 |
| ADM-R2 | Append-only admin audit log of actor/target/before-after. | `[IMPLEMENTED]` | `admin_action_log` (immutable), `src/lib/admin/audit.ts` | §6 item 2 |
| ADM-R3 | User management: view, suspend/unsuspend, soft/hard delete, revoke sessions, impersonate. | `[IMPLEMENTED]` | `app/api/admin/users/[id]/**` | §6 |
| ADM-R4 | Teacher approval workflow (approve/reject/request-info) with history. | `[IMPLEMENTED]` | `app/api/admin/teachers/**`, `teacher_approval_history` | core |
| ADM-R5 | Organization CRUD + linking codes. | `[IMPLEMENTED]` | `app/api/admin/organizations/**` | core |
| ADM-R6 | Curriculum CRUD (subjects/topics, bulk, clone-to-grade, reorder) + RAG `context_chunks`. | `[IMPLEMENTED]` | `topics/**`, `subjects/**`, `context-chunks/**`, `topic_context_chunks` | core |
| ADM-R7 | AI governance: versioned prompts (edit/test/activate) + usage/cost view. | `[IMPLEMENTED]` | `ai/prompts/**`, `ai/usage`, `ai_prompts`, `ai_calls`, `prompt-store.ts` | §6 |
| ADM-R8 | AI-output moderation queue + content blacklist. | `[IMPLEMENTED]` | `moderation/**`, `moderation_flags`, `content_blacklist`, `moderation.ts` | §4.27 |
| ADM-R9 | Live assessment ops: live grid, extend, pause/resume, force-submit, regrade, void, refund-credit, in-test message. | `[IMPLEMENTED]` | `app/api/admin/tests/**`, `admin_test_messages` | §4.28 |
| ADM-R10 | Speed/anomaly + tab-blur/pause signals on the live grid. | `[IMPLEMENTED]` | `anomalies.ts` | §4.7/§4.28 |
| ADM-R11 | Full SaaS billing ops: plans, coupons (incl. bulk + Razorpay offers), subscriptions lifecycle, payments + idempotent refunds, grants. | `[IMPLEMENTED]` | `app/api/admin/{plans,coupons,subscriptions,payments,grants}/**`, `admin_refund_idempotency` | core |
| ADM-R12 | Billing reconciliation: event replay, drift resolution, action-failure retry/resolve. | `[IMPLEMENTED]` | `billing/{events,reconciliation,action-failures}/**` | core |
| ADM-R13 | Communications: broadcasts (audience filter, preview/test/schedule/send), email templates, email log + suppressions, Resend webhooks. | `[IMPLEMENTED]` | `broadcasts/**`, `email-templates/**`, `email-log/**`, `broadcasts`, `email_templates`, `comms_audit` | §4.14 |
| ADM-R14 | Compliance/DSR: identity-verify → export/erase/reject, parental consent request/revoke, retention run-now; statutory deadline alerts. | `[IMPLEMENTED]` | `compliance/**`, `export-user-data.ts`, `erasure.ts`, `anonymize.ts`, `due-at.ts`, `alerts.ts` | §4.23 |
| ADM-R15 | Operations: provider health checks, integrity checks (run + check-specific auto-fix), job queues. | `[IMPLEMENTED]` | `system/health/**`, `system/integrity/**`, `jobs/**`, `service_health_pings`, `integrity_check_results`, `jobs` | §4.29/§4.30/§4.25 |
| ADM-R16 | Guarded SQL console: read-only by default; writable = fresh TOTP + table allowlist + per-verb gate + audited statement hash. | `[IMPLEMENTED]` | `system/sql/run/route.ts` runs `SET TRANSACTION READ ONLY` (~line 303); `sql/read-only.ts` tokenizer blocks DML/DDL/multi-statement; `sql/explain.ts` plan-cost gate | core (ops) |
| ADM-R17 | Analytics (overview/funnel/cohorts/export), performance recalc/reinit (+ bulk), global search, saved views, command palette. | `[IMPLEMENTED]` | `analytics/**`, `performance/**`, `search`, `saved-views`, `command-palette-registry.ts` | §3.3/§4.25 |
| ADM-R18 | Weekly operator digest. | `[IMPLEMENTED]` | `digest/weekly.ts`, `/api/internal/admin/weekly-digest` | §5.4 |
| ADM-R19 | Disable plaintext `ADMIN_PASSWORD` fallback in production. | `[IMPLEMENTED]` | `auth.ts:143` returns false when `NODE_ENV==='production'`; prod requires `ADMIN_PASSWORD_HASH_B64` (bcrypt) | §6 (security) |
| ADM-R20 | Read-only SQL must block CTE-with-DML escapes. | `[IMPLEMENTED]` | `sql/read-only.ts` `findForbiddenReadOnlyTerm` tokenizes (skips strings/comments/identifiers) and rejects DML in CTEs, multi-statements, `SET ROLE`, `FOR UPDATE`; backed by txn-level `SET TRANSACTION READ ONLY` | core (security) |
| ADM-R21 | JWT `kid`/key rotation; invalidate session cache on logout in HA. | `[IMPLEMENTED]` (kid) · `[PARTIAL]` (logout cache) | `auth.ts:20-44` kid-aware resolver + panic picks next `ADMIN_JWT_SECRET_vN`; confirm `invalidateAdminSessionCache` on logout across nodes | §6 (security) |
| ADM-R22 | Step-up TOTP on all sensitive actions (not just writable SQL). | `[PARTIAL]` | only SQL writable mode today | §6 (security) |
| ADM-R23 | Per-route automated tests for the ~130+ admin handlers; SQL read-only parser test suite. | `[GAP]` | sparse `tests/admin/` | — |

### 8.3 Data contracts & invariants (enforced)
- **Admin audit immutability** — `admin_action_log` is append-only (PDR §6 item 2). Writes precede side effects where possible.
- **Refund idempotency** — `admin_refund_idempotency.idempotency_key` PK guarantees one refund per key.
- **Webhook idempotency** — `billing_events.razorpay_event_id` UNIQUE; reprocessing is a replay, not a double-apply.
- **Usage-notification once** — `usage_notification_log` unique `(profile, usage_period, meter, threshold)`; server-only (RLS denies authenticated/anon).
- **SQL read-only guarantee** — read mode must not mutate; writable mode requires TOTP freshness + table allowlist + per-verb gate; statement hash audited (diff snapshot is `[GAP]`).
- **One subscription per profile** — `subscriptions.profile_id` UNIQUE; usage windows unique `(subscription_id, period_start)`.
- **Trial once per identity** — `free_trial_claims.identity_key` PK (normalized email/phone); `identity_blocklist` blocks abusers.

### 8.4 Telemetry & observability
- `admin_action_log` (who/what/before-after); `ai_calls` (AI cost/tokens); `service_health_pings` (provider health); `integrity_check_results` (data drift); `billing_events`/`billing_reconciliation_drift`/`billing_action_failures` (money correctness); `comms_audit`/`email_webhook_events` (delivery). Structured per-action metric counters are `[GAP]`.

### 8.5 Known gaps & next-step hooks (ordered by risk)
1. **ADM-R20 read-only SQL hardening** `[IMPLEMENTED]` — `SET TRANSACTION READ ONLY` + tokenizer guard shipped. Remaining: add the table-driven test suite `src/lib/admin/sql/__tests__/read-only.test.ts` (CTE-with-DML, multi-statement, comment-injected DML) to lock it in.
2. **ADM-R19 plaintext password guard** `[IMPLEMENTED]` — prod branch disabled in `auth.ts:143`. Optional: add an `instrumentation.ts` startup assertion that throws if `ADMIN_PASSWORD` is set in prod.
3. **ADM-R21 JWT rotation** `[IMPLEMENTED]` (kid). Remaining **Hook:** confirm `/api/admin/auth/logout` calls `invalidateAdminSessionCache(jti)` (+ bump `jwt_version`) so logout is honored before TTL across HA nodes.
4. **ADM-R22 step-up reauth** `[PARTIAL]` — **Hook:** add a `requireRecentTotp()` guard to a defined sensitive-action allowlist (mass deletes, teacher de-verify, panic).
5. **ADM-R16 SQL audit diff** `[PARTIAL]` — **Hook:** capture OLD/NEW row JSON via `RETURNING` for DML on allowlisted tables into the audit row.
6. **ADM-R23 tests** `[GAP]` — **Hook:** `tests/admin/routes/` (≥1 spec per route group) + Playwright for curriculum import and panic-revoke.
7. **Rate limits** on `/api/admin/system/sql/run` and `/api/admin/panic`; **CIDR/IPv6** support in `ip-allowlist.ts`.
