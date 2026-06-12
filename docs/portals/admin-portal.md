# 24Vertex — Admin Portal

**Snapshot:** 2026-06-12 · branch `main` @ `27d7fbb`. The §8 status tags were re-verified against current code on this date (superseding the 2026-05-31 snapshot `8f69969` — the June security series M1–M3/L1–L10 closed most of the remaining auth/step-up/audit gaps, and several §8.5 hooks listed in the previous snapshot had in fact already shipped in the audit-closure PR #76).
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
- **Credentials:** bcrypt password hash (`bcryptjs`, cost ≥ 12 enforced in prod) + **TOTP** (`otplib`) two-factor. Login core `src/lib/admin/login-core.ts`, `auth.ts`, `totp.ts`. TOTP-rotation runbook: `docs/admin/totp-rotation.md`.
- **Single-use TOTP (M2):** every verification site — login and all step-ups — goes through `consumeAdminTotp()` (`auth.ts`), which compare-and-sets the code's 30s clock step into `admin_runtime_kv` (`totp_last_step`, `tryConsumeAdminTotpStep` in `runtime-pg.ts`). A replayed code is rejected; each privileged action needs a fresh code. Fails **open** on a DB error (the code is still a valid TOTP).
- **Prod boot assertions (`instrumentation.ts`):** production refuses to start if plaintext `ADMIN_PASSWORD` is set (D1), if `SAAS_ENFORCEMENT` is not explicitly `"true"`/`"false"` (C-1), or if **neither** `ADMIN_IP_ALLOWLIST` nor `ADMIN_TOTP_SECRET` is configured (L1 — a second factor is mandatory because the login rate limiter fails open on DB error).
- **Sessions:** signed JWTs via `jose` (`src/lib/admin/jwt-edge.ts`) with `kid`-based key rotation (`ADMIN_JWT_SECRET_vN`), stored/tracked in `admin_sessions`; short-TTL in-process cache (`api-auth.ts`). Logout revokes the jti in DB, evicts the local cache, and writes a cross-process revocation tombstone to `admin_runtime_kv` (D10, `recordAdminSessionRevocation`) so peer nodes honor it within their cache TTL.
- **Network controls:** IP allowlist with IPv4/IPv6 + CIDR support (`ip-allowlist.ts`, D7), login rate limiting (`admin_login_rate`, `login-rate-limit.ts` — fails open but now logs loudly via `logServerError`).
- **Panic revoke:** `app/api/admin/panic` requires `ADMIN_PANIC_TOKEN` **and** a fresh single-use TOTP (D11; refuses to run if `ADMIN_TOTP_SECRET` is unset), is per-IP rate-limited (D6, 5/10min), bumps `jwt_version`, and rotates the JWT `kid` to the next available `ADMIN_JWT_SECRET_vN`.
- **Step-up (fresh single-use TOTP):** writable SQL console, compliance erasure, retention run-now, user hard-delete (when the `ADMIN_TOTP_REQUIRED` flag is on), **impersonation** (always, fail-closed — L3), and panic.
- **Routes:** `app/admin/login`, `app/api/admin/auth/{login,logout,session}`. Protected pages live under `app/admin/(authenticated)/` with `layout.tsx` + `loading.tsx`.

### 3.3 Admin sections (navigation)
Under `app/admin/(authenticated)/`: `dashboard`, `users`, `organizations`, `curriculum`, `assessments`, `ai`, `analytics`, `performance`, `billing`, `communications`, `compliance`, `audit`, `system`.

### 3.4 Data model — admin-specific & governed tables
*(Drizzle definitions in `src/db/schema/`. Admins also read/write most application tables described in the other portal docs.)*

| Table | Purpose |
|---|---|
| `admin_sessions` | Active admin JWT sessions (revocable). |
| `admin_login_rate` | Admin login attempt throttling. |
| `admin_runtime_kv` | Runtime key/value: `jwt_version` (panic), JWT `kid`, TOTP secret fingerprint, single-use TOTP `totp_last_step` (M2), per-jti `revoked:*` session tombstones (D10). |
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
`app/api/admin/**` is the largest API area in the codebase (~145 handlers). Major groups: `users`, `teachers`, `organizations`, `subjects`/`topics`/`context-chunks` (curriculum), `tests` (assessments), `ai/prompts`/`ai/usage`, `analytics`, `performance`, `billing`/`payments`/`plans`/`coupons`/`subscriptions`/`grants`, `broadcasts`/`email-templates`/`email-log`, `compliance`, `moderation`, `audit`, `system` (`health`, `integrity`, `sql`), `feedback`, `saved-views`, `search`, `dashboard`, `sessions`, `trial-claims`, `panic`, `jobs`. A CI regression test (`tests/admin/admin-routes-require-auth.test.ts`, M12) fails the build if any admin route omits `requireAdminApi()` (allowlist: the auth endpoints + panic). Internal cron/worker endpoints live under `app/api/internal/**` (billing reconcile/dunning/trial-emails/pause-auto-cancel/expire-coupons, practice auto-submit/run-jobs/metrics/**review-scheduler**, compliance-retention, health-pings, integrity-checks, weekly-digest, doubt-chat cleanup, and **`ops/cron-heartbeat`** — a queue-backlog probe that detects a stalled pg_cron→pg_net substrate independently of the substrate itself; meant to be polled by an external uptime monitor with `Bearer <CRON_SECRET>`). Internal-route auth: `src/lib/internal/cron-auth.ts` — the unauthenticated dev bypass now requires an explicit `ALLOW_UNAUTHENTICATED_CRON_DEV=1` on loopback (L5).

### 3.6 Curriculum & AI governance
- **Curriculum:** subjects/topics CRUD (`topics/bulk`, `topics/clone-to-grade`, `subjects/reorder`), and `context-chunks` (the `topic_context_chunks` RAG source). Import tooling in `src/lib/admin/import/`. (The repo also ships skills `topics-creator`, `topic-context-creator`, `topics-questions-chunks` that turn NCERT/question-bank PDFs into importable CSVs.)
- **AI:** `ai/prompts` (versioned prompts editable in a Monaco editor, with `test` and `activate`), `ai/usage` over `ai_calls`, moderation queue (`moderation/flags`, `moderation/blacklist`). Prompt store `src/lib/ai/prompt-store.ts`. The `prompts/[id]/test` route is cost-bounded: per-admin rate limit (`rlConsume`), `maxDuration = 30`, and `maxOutputTokens` clamped to `ADMIN_PROMPT_TEST_MAX_OUTPUT_TOKENS`.

### 3.7 Billing & operations
- **Plans/coupons:** plans (`plans/[code]/sync-razorpay`), coupons (`coupons/bulk-generate`, `[code]/sync-razorpay-offers`, redemptions).
- **Subscriptions:** rich lifecycle ops (`change-plan`, `cancel-now`/`cancel-at-period-end`, `pause`/`resume`, `force-renew`, `apply-coupon`, `staff-override`, `recompute-usage`, `grants`). Logic in `src/lib/billing/subscription-*` + `src/lib/admin/billing/`.
- **Payments:** view + `refund` (idempotent via `admin_refund_idempotency`).
- **Reconciliation:** `billing/events/[id]/replay`, `reconciliation/[id]/resolve`, `action-failures/[id]/{retry,resolve}` — keep local state in sync with Razorpay (`billing_reconciliation_drift`, `billing_action_failures`, `billing_events`).
- **Jobs:** `jobs`/`jobs/queues` (pause/resume), `jobs/[id]` (retry/cancel/promote), schedules — over `operator_jobs`. The drain (`/api/internal/admin/process-operator-jobs` → `runOperatorJobDrain`) now leases jobs and **reclaims** ones stuck active past their lease (arch review M2), reporting a `reclaimed` count.

### 3.8 Assessments operations
`app/api/admin/tests/**`: `live` (in-flight tests), `[id]` view, `extend` (timer), `pause`/`resume`, `force-submit`, `regrade`, `void`, `refund-credit`, `message` (push a message into a live test via `admin_test_messages`), `answers`. These manipulate `tests`/`student_answers` integrity fields (`isPaused`, `adminExtensions`, `accumulatedPauseSeconds`).

### 3.9 Compliance, audit & system
- **Compliance:** `compliance/requests/[id]/{export,erase,reject,verify-identity}` (DPDP subject-rights), `consents/[studentId]/{request,revoke}`, `retention/[entity]/run-now`. Anonymisation in `src/lib/admin/anonymize.ts`.
- **System:** `system/health/[provider]/check` (`service_health_pings`), `system/integrity/checks/[name]/{run,fix}` (`integrity_check_results`), and the **SQL console** `system/sql/run` (read-only by default; writable mode requires fresh TOTP + table allowlist + per-verb gate + audited statement hash; parser in `src/lib/admin/sql/read-only.ts`).
- **Users:** `[id]/{suspend,unsuspend,soft-delete,hard-delete,revoke-sessions,impersonate}` — impersonation lets support reproduce a user's view; it now demands a fresh single-use TOTP (fail-closed; 403 if `ADMIN_TOTP_SECRET` is unconfigured), is rate-limited to 5/min per admin+IP, and the magic-link mint is strict-audited. **Hard delete is "erase + ban"** (`performComplianceErasure` then a permanent `ban_duration`) because `audit_logs`/`payments`/`tests` reference `auth.users` with `ON DELETE NO ACTION` — the auth row is retained, anonymized, and banned.
- **Audit:** `admin_action_log` records actor/target/before-after for admin writes. High-blast-radius writes (~60 routes: refunds, subscription lifecycle incl. `staff-override` (L2), broadcasts send/test, compliance ops, hard-delete pre+post, impersonate, panic, SQL writes, …) use `writeAdminActionStrict` — if the audit insert fails the action is refused with a 5xx instead of committing unobserved.
- **DB-level guards (defense in depth):** SECURITY DEFINER RPCs reachable via PostgREST now carry in-function authorization — owner/service-role checks on `refresh_student_activity_streak`, `practice_enqueue_job`, `practice_update_tracker_running` and the teacher-scope helpers; `EXECUTE` revoked from `authenticated` on `compute_student_activity_streak` (`20260702000000_security_idor_hardening.sql`). `admin_set_teacher_verified` rejects any real authenticated non-service_role caller while keeping the direct-Drizzle path (where `auth.uid()` is NULL) working, and `link_parent_to_student`'s pending/confirm flow was restored after the rebrand migration had silently reverted it (`20260706000000_restore_parent_link_confirmation_and_harden_admin_rpcs.sql`, M1+L4).

---

## 4. Capabilities, feature by feature

### 4.1 Sign in securely (2FA + IP + panic)
- **[Plain]** Staff log in with a password and a 6-digit authenticator code, only from approved networks. Each code works exactly once — even if someone steals a code over your shoulder, it can't be reused. The most dangerous actions (impersonating a user, erasing data, the emergency "panic" logout-everyone button) each demand a fresh code. In production the system refuses to even start without a second factor configured.
- **[Technical]** bcrypt (cost ≥ 12) + single-use TOTP (`consumeAdminTotp`) + `jose` JWT with `kid` rotation + IP allowlist (CIDR/IPv6) + login rate limit + prod boot assertions (`instrumentation.ts`); `panic` = `ADMIN_PANIC_TOKEN` + fresh TOTP + per-IP rate limit, bumps the token version and rotates the signing key. Step-up TOTP on writable SQL, erasure, retention run-now, hard-delete (flag-gated), and impersonation.

### 4.2 Manage users
- **[Plain]** Search any user, view their full profile and activity, suspend or delete them, reset their sessions, or temporarily "see what they see" to help with a support ticket. "Seeing what they see" and permanent deletion both require typing a fresh authenticator code, and every such action is written to a tamper-proof log before it happens — if the log can't be written, the action is refused.
- **[Technical]** `users` list + `[userId]` detail (multi-tab) → suspend/unsuspend, soft/hard delete, revoke-sessions, impersonate. Impersonate = fail-closed single-use TOTP + 5/min rate limit; hard-delete = confirm-email + (flag-gated) TOTP + rate limit + strict pre/post audit + erase-and-ban. Writes audited to `admin_action_log`.

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
- **[Plain]** Check that all the external services are up, run data-integrity checks (and auto-fix some), manage background jobs, and — carefully — run database queries for deep support. A dedicated heartbeat can tell an outside monitoring service when the platform's scheduled-job machinery has silently stalled, and jobs that get stuck are automatically reclaimed.
- **[Technical]** `system/health`, `system/integrity` (run/fix), `jobs`/queues (with lease/reclaim on the drain), the guarded `system/sql/run` console (read-only default; writable = fresh single-use TOTP + allowlist + audit; per-admin action rate limit), and `/api/internal/ops/cron-heartbeat` (pg_cron-substrate stall detection via practice-job backlog, for an external uptime monitor).

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

- **The previously listed auth/step-up gaps are closed:** logout invalidation across nodes (D10 tombstones in `admin_runtime_kv` + `invalidateAdminSessionCache`), plaintext-password prod block (now also a boot-time throw in `instrumentation.ts`), single-use TOTP everywhere (M2), impersonation step-up (L3), strict audit on staff-override/hard-delete/impersonate (L2), SQL-parser test suites (`tests/admin/sql-read-only.test.ts`, `sql-write-guard.test.ts`), per-route specs for every admin route group (`tests/admin/routes/`, ~124 specs), CIDR/IPv6 allowlist, and rate limits on `system/sql/run` + `panic`.
- **Fail-open trade-offs remain by design:** `tryConsumeAdminTotpStep` returns true on a DB error (replay protection degrades during a KV outage — the code is still a valid TOTP), and the admin-login rate limiter fails open on DB error (now loud-logged, and backstopped by the boot-mandated second factor). Both are deliberate "don't lock every admin out" choices, not omissions.
- **Step-up TOTP residue:** hard-delete only *consumes* (single-uses) the code when the `ADMIN_TOTP_REQUIRED` flag is on; soft-delete, revoke-sessions, and teacher de-verification have no TOTP step-up at all (they rely on strict audit + per-action rate limits).
- **SQL writable-mode audit** records the statement hash but still no OLD/NEW row diff snapshot.
- **Review-scheduler rollout knobs** (`review_scheduler_rollout_pct()`, `review_scheduler_cohort_org_ids()`, kill-switch `review_scheduler_enabled()`) are DB-side SQL functions flipped via `CREATE OR REPLACE` — there is no admin UI for them; changing the cohort is a migration/SQL-console operation on **both** Supabase projects.
- **`/api/internal/ops/cron-heartbeat` only helps if watched:** wiring an external (non-Vercel, non-Supabase) uptime monitor to poll it is an open ops task (see route docstring).
- Heavy client deps (Monaco editor, Recharts) and missing parallelisation affect some admin pages' performance.
- See `docs/audit/admin-portal.md`, `docs/admin/ops-readiness.md`, and `docs/admin/totp-rotation.md` for the full punch list and runbooks.

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
| Security hardening `20260702000000_security_idor_hardening.sql` + `20260706000000_restore_parent_link_confirmation_and_harden_admin_rpcs.sql` | §6 (security) | in-function authz on SECURITY DEFINER RPCs; `admin_set_teacher_verified` guard; parent-link pending/confirm restored |
| (cross-cutting) | §3.3 | command palette (jumps = navigation-only; actions confirm) |
| (cross-cutting) | §5.4 | weekly operator digest (`src/lib/admin/digest/weekly.ts`) |

### 8.1 Entity state machines

**Admin session** (`admin_sessions` + `jwt_version`/`kid`/tombstones in `admin_runtime_kv`)
```
login (bcrypt + single-use TOTP + IP allowlist (CIDR/IPv6) + rate-limit) ──▶ active (jose JWT w/ kid, jti in admin_sessions)
active ──(logout)──▶ revoked (DB) + local cache evicted + cross-process tombstone `revoked:<jti>` (D10)
active ──(panic: ADMIN_PANIC_TOKEN + fresh TOTP, per-IP rate-limited)──▶ ALL revoked (bump jwt_version + rotate kid → next ADMIN_JWT_SECRET_vN)
active ──(TTL elapse)──▶ re-validated against DB
step-up ops (writable SQL · erase · retention run-now · impersonate · hard-delete*) ──fresh TOTP, consumed single-use (admin_runtime_kv.totp_last_step CAS)──▶ allowed
   * hard-delete consumes only when ADMIN_TOTP_REQUIRED flag is on
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
queued ──▶ running (leased) ──▶ done
                  ├──▶ failed (attempts++ ≤ maxAttempts; error)
                  └──(lease expired: stuck-active)──▶ reclaimed ──▶ queued   [arch M2]
controls: pause/resume queue · retry/cancel/promote job
processor: /api/internal/admin/process-operator-jobs (runOperatorJobDrain → {processed, stoppedForPause, reclaimed})
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
| ADM-R1 | Separate hardened admin auth: bcrypt + TOTP 2FA + IP allowlist + login rate-limit + panic revoke. | `[IMPLEMENTED]` | `login-core.ts`, `auth.ts`, `totp.ts`, `ip-allowlist.ts` (CIDR/IPv6), `jwt-edge.ts`, `/api/admin/panic` (token + TOTP + rate limit) | §6 |
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
| ADM-R16 | Guarded SQL console: read-only by default; writable = fresh TOTP + table allowlist + per-verb gate + audited statement hash. | `[IMPLEMENTED]` | `system/sql/run/route.ts` runs `SET TRANSACTION READ ONLY` + per-admin action rate limit; TOTP is single-use (`consumeAdminTotp`); `sql/read-only.ts` tokenizer blocks DML/DDL/multi-statement; `sql/explain.ts` plan-cost gate; parser suites `tests/admin/sql-read-only.test.ts`, `sql-write-guard.test.ts` | core (ops) |
| ADM-R17 | Analytics (overview/funnel/cohorts/export), performance recalc/reinit (+ bulk), global search, saved views, command palette. | `[IMPLEMENTED]` | `analytics/**`, `performance/**`, `search`, `saved-views`, `command-palette-registry.ts` | §3.3/§4.25 |
| ADM-R18 | Weekly operator digest. | `[IMPLEMENTED]` | `digest/weekly.ts`, `/api/internal/admin/weekly-digest` | §5.4 |
| ADM-R19 | Disable plaintext `ADMIN_PASSWORD` fallback in production. | `[IMPLEMENTED]` | `auth.ts` returns false when `NODE_ENV==='production'`; `instrumentation.ts` additionally **throws at boot** (D1) if `ADMIN_PASSWORD` is set in prod; prod requires `ADMIN_PASSWORD_HASH_B64` (bcrypt, cost ≥ 12) | §6 (security) |
| ADM-R20 | Read-only SQL must block CTE-with-DML escapes. | `[IMPLEMENTED]` | `sql/read-only.ts` `findForbiddenReadOnlyTerm` tokenizes (skips strings/comments/identifiers) and rejects DML in CTEs, multi-statements, `SET ROLE`, `FOR UPDATE`; backed by txn-level `SET TRANSACTION READ ONLY` | core (security) |
| ADM-R21 | JWT `kid`/key rotation; invalidate session cache on logout in HA. | `[IMPLEMENTED]` | `auth.ts` kid-aware resolver + panic picks next `ADMIN_JWT_SECRET_vN`; logout calls `invalidateAdminSessionCache(jti)` + writes a cross-process tombstone (D10, `recordAdminSessionRevocation`); `tests/admin/session-revoke-tombstone.test.ts`, `jwt-kid-rotation.test.ts` | §6 (security) |
| ADM-R22 | Step-up TOTP on all sensitive actions (not just writable SQL). | `[PARTIAL]` | now covers writable SQL, compliance erase, retention run-now, impersonate (fail-closed, L3), panic (D11), hard-delete (consumed only when `ADMIN_TOTP_REQUIRED` flag on) — all single-use via `consumeAdminTotp`. Remaining: soft-delete, revoke-sessions, teacher de-verification (strict audit + rate limits only) | §6 (security) |
| ADM-R23 | Per-route automated tests for the ~145 admin handlers; SQL read-only parser test suite. | `[IMPLEMENTED]` | `tests/admin/routes/` (~124 specs, ≥1 per route group), `sql-read-only.test.ts` + `sql-write-guard.test.ts` (table-driven parser), `consume-admin-totp.test.ts`, `totp-step-consume.test.ts`; run in CI by `.github/workflows/admin-panel.yml` (+ `admin-e2e.yml` Playwright when secrets present) | — |
| ADM-R24 | Single-use (anti-replay) admin TOTP across login and every step-up site. | `[IMPLEMENTED]` | `consumeAdminTotp` (`auth.ts`) + `tryConsumeAdminTotpStep` CAS on `admin_runtime_kv.totp_last_step` (`runtime-pg.ts`, fails open on DB error); migrated all verification sites in `0e976fe` (M2) | §6 (security) |
| ADM-R25 | Impersonation requires fail-closed TOTP step-up + per-admin rate limit + strict audit. | `[IMPLEMENTED]` | `users/[id]/impersonate/route.ts`: 403 when `ADMIN_TOTP_SECRET` unset, 401 without fresh code, 5/min per jti+IP, `writeAdminActionStrict` before returning the magic link (L3) | §6 (security) |
| ADM-R26 | Production boot assertions: no plaintext admin password; explicit `SAAS_ENFORCEMENT`; mandatory admin second factor (`ADMIN_IP_ALLOWLIST` and/or `ADMIN_TOTP_SECRET`). | `[IMPLEMENTED]` | `instrumentation.ts` `register()` throws (D1, C-1, L1) — a misconfigured deploy fails fast instead of shipping weakened auth | §6 (security) |
| ADM-R27 | Fail-closed (strict) audit on high-blast-radius admin writes — action refused if the audit row can't be written. | `[IMPLEMENTED]` | `writeAdminActionStrict` on ~60 routes incl. `subscriptions/[id]/staff-override` (L2 — unlimited-access grant), hard-delete pre+post, impersonate, refunds, broadcasts send, compliance ops | §6 item 2 |
| ADM-R28 | Hard delete = compliance erasure + permanent auth ban (auth row retained for `NO ACTION` FK consumers: `audit_logs`, `payments`, FERPA-retained `tests`). | `[IMPLEMENTED]` | `users/[id]/hard-delete/route.ts`: `performComplianceErasure` then `updateUserById(..., { ban_duration: "876600h" })`; confirm-email + rate limit + flag-gated TOTP | §4.23/§6 |
| ADM-R29 | DB-level function authorization on SECURITY DEFINER RPCs (PostgREST IDOR hardening), incl. `admin_set_teacher_verified` and restored `link_parent_to_student` pending/confirm. | `[IMPLEMENTED]` | `20260702000000_security_idor_hardening.sql` (streak/practice/teacher-helper guards, EXECUTE revokes), `20260706000000_restore_parent_link_confirmation_and_harden_admin_rpcs.sql` (M1+L4) — applied to BOTH Supabase projects | §6 (security) |
| ADM-R30 | CI regression guard: every admin API route enforces `requireAdminApi()`; every student/parent/teacher API route authenticates. | `[IMPLEMENTED]` | `tests/admin/admin-routes-require-auth.test.ts` (M12; allowlist = auth endpoints + panic), H5 counterpart for user-facing routes | §6 (security) |
| ADM-R31 | Background-ops resilience: cron-substrate heartbeat + operator-job lease/reclaim + review-scheduler kill-switch & staged-rollout cohort. | `[IMPLEMENTED]` | `/api/internal/ops/cron-heartbeat` (H1, queue-backlog probe), `runOperatorJobDrain` reclaim (arch M2), `review_scheduler_enabled()` + `review_scheduler_rollout_pct()` + `review_scheduler_cohort_org_ids()` feeding nightly pg_cron → `/api/internal/practice/review-scheduler` (`20260704020000/30000`) | §4.25/§4.29 |
| ADM-R32 | Internal cron & webhook auth hardening: explicit dev-only bypass flag; dedicated Resend bearer secret. | `[IMPLEMENTED]` | `cron-auth.ts` honors `ALLOW_UNAUTHENTICATED_CRON_DEV=1` only on loopback in dev (L5); `app/api/webhooks/resend/route.ts` manual path uses `RESEND_WEBHOOK_BEARER`, distinct from the Svix secret (L6); both documented in `.env.example` | §6 (security) |
| ADM-R33 | Cost-bound the admin AI prompt-test endpoint. | `[IMPLEMENTED]` | `ai/prompts/[id]/test/route.ts`: per-admin `rlConsume` rate limit, `maxDuration = 30`, `maxOutputTokens` clamp | §6 (AI governance) |

### 8.3 Data contracts & invariants (enforced)
- **Admin audit immutability** — `admin_action_log` is append-only (PDR §6 item 2). Writes precede side effects where possible; on the strict routes (ADM-R27) a failed audit write **blocks** the action.
- **TOTP single-use** — `admin_runtime_kv.totp_last_step` only ever advances (CAS `setWhere value_int < step`); a code whose 30s step is ≤ the stored value is a replay and is rejected (degrades open only on a KV/DB error).
- **Hard delete never orphans FKs** — the auth row is anonymized + banned, never physically deleted (`audit_logs`/`payments`/`tests` hold `ON DELETE NO ACTION` references).
- **Refund idempotency** — `admin_refund_idempotency.idempotency_key` PK guarantees one refund per key.
- **Webhook idempotency** — `billing_events.razorpay_event_id` UNIQUE; reprocessing is a replay, not a double-apply.
- **Usage-notification once** — `usage_notification_log` unique `(profile, usage_period, meter, threshold)`; server-only (RLS denies authenticated/anon).
- **SQL read-only guarantee** — read mode must not mutate; writable mode requires TOTP freshness + table allowlist + per-verb gate; statement hash audited (diff snapshot is `[GAP]`).
- **One subscription per profile** — `subscriptions.profile_id` UNIQUE; usage windows unique `(subscription_id, period_start)`.
- **Trial once per identity** — `free_trial_claims.identity_key` PK (normalized email/phone); `identity_blocklist` blocks abusers.

### 8.4 Telemetry & observability
- `admin_action_log` (who/what/before-after, `totpUsed` flag, rate-limited attempts logged with `rate_limited: true`); `ai_calls` (AI cost/tokens); `service_health_pings` (provider health); `integrity_check_results` (data drift); `billing_events`/`billing_reconciliation_drift`/`billing_action_failures` (money correctness); `comms_audit`/`email_webhook_events` (delivery). New: `admin.login_rate.check_failed` loud server log when the login limiter degrades open; `/api/internal/ops/cron-heartbeat` 503s when the pg_cron substrate stalls; operator-job drain reports `reclaimed`; Sentry events for panic anomalies (`admin_panic_missing_totp_secret`, kid-rotation audit rows). Structured per-action metric counters are `[GAP]`.

### 8.5 Known gaps & next-step hooks (ordered by risk)
*(Closed since the previous snapshot: SQL parser test suite, `instrumentation.ts` plaintext-password assertion, logout cache invalidation/D10 tombstones, per-route tests, sql/panic rate limits, CIDR/IPv6 allowlist — see ADM-R19/R21/R23/R26 above.)*
1. **ADM-R22 step-up residue** `[PARTIAL]` — **Hook:** extend the single-use TOTP step-up to soft-delete, revoke-sessions, and teacher de-verification, and make hard-delete consume the code unconditionally (today it consumes only when the `ADMIN_TOTP_REQUIRED` flag is on, `users/[id]/hard-delete/route.ts`).
2. **ADM-R16 SQL audit diff** `[PARTIAL]` — **Hook:** capture OLD/NEW row JSON via `RETURNING` for DML on allowlisted tables into the audit row (statement hash only today).
3. **ADM-R24 fail-open replay window** — **Hook:** consider failing **closed** in `tryConsumeAdminTotpStep` for the two highest-blast-radius sites (impersonate, panic), or at minimum a Sentry alert on the DB-error fallback path.
4. **ADM-R31 heartbeat unwatched** — **Hook:** wire an external (non-Vercel, non-Supabase) uptime monitor to `GET /api/internal/ops/cron-heartbeat` with `Bearer <CRON_SECRET>` every 1–5 min (see route docstring + `docs/admin/ops-readiness.md`).
5. **Review-scheduler rollout has no admin UI** — cohort/percentage changes are `CREATE OR REPLACE FUNCTION` migrations applied to both projects. **Hook:** an `admin/system` panel (or at least a saved SQL-console snippet) over the three knobs, with audit.
6. **Structured per-action metric counters** (§8.4) `[GAP]` — audit rows exist, but no aggregated counters/dashboards per admin action.
