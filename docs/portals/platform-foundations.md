# 24Vertex — Platform Foundations (shared across all portals)

**Snapshot:** 2026-05-31 · branch `claude/festive-goldberg-e79b4b` @ `8f69969`. Verified against current code on this date.
**Product:** 24Vertex (display) · `vertex24` (technical slug) · `eduai` (legacy slug). NCERT curriculum, grades 6–12, India.
**Purpose:** the cross-cutting systems every portal depends on. The four portal docs ([student](student-portal.md), [teacher](teacher-portal.md), [parent](parent-portal.md), [admin](admin-portal.md)) reference this file instead of repeating it. **[Plain]** = any reader · **[Technical]** = dense, for engineers/LLMs.

---

## 1. Stack — [Technical]
- **Framework:** Next.js 16 (App Router, React 19, Server Components + Server Actions), TypeScript, on Vercel (Node 24).
- **Data:** Supabase Postgres via **Drizzle ORM** (`src/db/schema/*.ts`, typed server queries) and the **Supabase JS client** (`@supabase/ssr`, RLS-scoped reads + Realtime). Storage buckets for attachments + PDFs.
- **AI:** Vercel AI SDK v6 (`ai`, `@ai-sdk/deepseek`, `@ai-sdk/openai`, `@ai-sdk/react`) behind a model router — DeepSeek primary (cost), OpenAI fallback (capability).
- **UI:** Tailwind v4 + shadcn/Radix; charts Recharts + Plotly + Mafs + `function-plot`; math KaTeX (`rehype-katex`/`remark-math`); PDF `@react-pdf/renderer`; rich text TipTap; chemistry `smiles-drawer`; diagrams Mermaid/Three; OCR `tesseract.js`.
- **Infra:** Sentry (`instrumentation.ts`, `sentry.*.config.ts`); Upstash Redis rate limiting (`src/lib/ratelimit/**`); Resend email; Razorpay billing.
- **Request proxy:** `proxy.ts` (Node runtime) runs per-portal gates, CSP nonce per path, maintenance routing, and request-id correlation on every request.

## 2. Roles & authentication — [Technical]
- **Students / parents / teachers:** Supabase Auth (email/password + recovery). The signed-in user maps to a `profiles` row with `role ∈ {student, parent, teacher}`.
- **Admins:** a **separate hardened stack** (no Supabase Auth): bcrypt (`ADMIN_PASSWORD_HASH_B64`) + TOTP 2FA (`otplib`) + `jose` JWT with **`kid`-based key rotation** + IP allowlist + login rate limit + panic-revoke. Plaintext `ADMIN_PASSWORD` is **rejected in production** (`src/lib/admin/auth.ts:143`).
- **Guard helpers (`src/lib/auth/`):** `requireUser({ role })` dispatches to `requireVerifiedStudent`, `requireParent`, `getVerifiedTeacherSession`. Portal layouts use these (student → `requireVerifiedStudent()`, parent → `requireParent()`, teacher protected → `requireVerifiedTeacher()` with suspended/not-verified redirects).
- **CSRF/origin gating:** `proxy.ts` runs `studentProxyGate`, `parentProxyGate`, `teacherProxyGate`, `adminProxyGate`, `billingProxyGate`, `feedbackProxyGate`, `contactProxyGate`. Each rejects mismatched `Origin` on `POST/PUT/PATCH/DELETE` via `originAllowed` (`src/lib/security/origin-guard.ts`). Server-to-server (no Origin) passes through.

## 3. Data model — table backbone — [Technical]
*(Drizzle: `src/db/schema/`. Grouped by domain.)*
- **Identity/links:** `profiles` (role, grade/section/stream, `studentLinkCode`, `organizationId`, suspend/soft-delete), `parent_student_links`, `teacher_student_links`, `teacher_organization_memberships`, `organizations`.
- **Curriculum:** `subjects` → `topics` (unit→chapter→topic + learning objectives), `topic_context_chunks` (RAG source).
- **Assessment/practice:** `tests`, `questions` (+ pgvector `embedding`), `student_answers`, `test_reports`, `question_flags`, `performance_tracker`, `practice_jobs`, `practice_generation_runs`/`_steps`, `practice_analytics_events`, `student_activity_streaks`.
- **Assignments:** `assignments`, `assignment_submissions`.
- **Doubt (AI tutor):** `doubt_conversations`, `doubt_messages`, `doubt_message_attachments`.
- **Billing:** `plans`, `subscriptions`, `usage_periods`, `quota_grants`, `free_trial_claims`, `identity_blocklist`, `payments`, `coupons`, `coupon_redemptions`, `billing_events`, `billing_plan_changes`, `billing_reconciliation_drift`, `billing_action_failures`, `usage_notification_log`, `admin_refund_idempotency`.
- **Admin/ops:** `admin_sessions`, `admin_login_rate`, `admin_runtime_kv`, `admin_saved_views`, `admin_action_log` (append-only), `feature_flags`, `operator_jobs` (`jobs`), `integrity_check_results`, `service_health_pings`.
- **AI governance:** `ai_prompts` (versioned), `ai_calls` (cost/tokens).
- **Comms:** `broadcasts`, `email_templates`, `email_webhook_events`, `comms_audit`, `notifications` (defined in `comms-audit.ts`).
- **Compliance/safety:** `parental_consents`, `compliance_requests`, `retention_policies`, `moderation_flags`, `content_blacklist`, `teacher_approval_history`, `user_feedback_reports`.

## 4. AI pipelines — [Technical]
- **Practice generation** (`src/lib/practice/practice-generation-pipeline.ts`): config resolve → quota preflight → blueprint (deterministic or LLM) → evidence pack / RAG (`topic_context_chunks`) → batched generation (sister-brief for cross-batch coherence) → editor → repair + deterministic autofix + single-question replacement → quality gates (pgvector near-dup, topic concentration, visual/chunk alignment) → validation + audit/normalize + KaTeX normalize → moderation pre/post. Resilience: model router failover, reason-aware retries, low-context fallback. Streaming via SSE envelope. Telemetry → `practice_generation_runs`/`_steps`.
- **Structured output** (`src/lib/ai/structured-output.ts`): OpenAI strict structured output vs DeepSeek JSON-mode bifurcation.
- **Grading** (`ai-grade-practice-test.tsx` + `grading-*.ts`): per-answer scoring + model/user answer summaries + feedback → `student_answers` + `test_reports` → `performance_tracker` rollup.
- **Known reliability gaps:** no independent answer-key verifier, distractor judge, self-consistency ensemble, VLM diagram judge, or golden-set CI regression harness (see [student-portal.md](student-portal.md) §8.5).

## 5. Doubt-chat (AI tutor) — [Technical]
Modes `explain | solve_with_me | quiz_me` (`doubt-tutor-mode.ts`). On-syllabus scope (`scope-precheck.ts`, `validate-doubt-scope.ts`); 12 subject packs (`docs/doubt-subject-packs/*.md`) + shared preamble; deterministic safety screen (`safety.ts`, `safety-detectors.ts`); attachments (image/PDF) → Storage with OCR `ocrText`; KaTeX + Markdown rendering. Gated by `canStartDoubtChat`; output tokens metered via `consumeTokens`.

## 6. Billing & entitlements — [Plain] + [Technical]
- **[Plain]** Three plans: **Free Trial** (₹0, 5 tests, 50k AI tokens), **Pro Monthly** (₹1,000, 30 tests, 200k/400k tokens by grade), **Pro Annual** (₹10,000, 360 tests, ~17% saving). Access is gated by two meters: practice **tests** and doubt-chat **AI tokens**, reset each billing period.
- **[Technical]** `plans`, `subscriptions` (status `trialing|active|coupon|grace|past_due|cancelled|expired`), `usage_periods` (tests/tokens quota+used). Entitlement snapshot (`src/lib/billing/entitlements.ts`) derives `canStartTest` (testsLeft>0) and `canChatDoubt` (tokensLeft>0). **Fail-closed** on billing infra errors; `consumeTest`/`refundTest` are compensating; `SAAS_ENFORCEMENT=false` or `staffOverride` bypass. One trial per normalized identity (`free_trial_claims`). Razorpay webhooks idempotent via `billing_events.razorpay_event_id`; dunning/reconciliation under `app/api/internal/billing/**` + admin tools.

## 7. Notifications & email — [Technical]
In-app `notifications` + Resend email via `src/lib/notifications/**`: report-ready, usage thresholds (80/100%, idempotent via `usage_notification_log`), trial reminders, assignment events, account-security, org events. Admin broadcasts/templates with delivery webhooks (`comms_audit`, `email_webhook_events`). Per-portal notification APIs are rate-limited.

## 8. Security & compliance — [Technical]
- CSRF/origin gates (§2), Upstash rate limiting, CSP with per-request nonce (`src/lib/security/csp.ts`), input validation (Zod; auth schemas `.strict()`).
- AI-output moderation (`src/lib/ai/moderation.ts`, `moderation_flags`, `content_blacklist`).
- DPDP-style: `parental_consents` (guardian consent for minors), `compliance_requests` (DSR: `open → in_progress → fulfilled|rejected|erased`, statutory `dueAt`), `retention_policies`, anonymisation/export/erasure.
- Audit: append-only `admin_action_log`; rich linking audit in the parent flow.

## 9. PDR convention — [Technical]
Features map to the canonical *Product Design Requirements* (PDR v3.0), referenced inline in code as `PDR §x.y` (the master doc lives outside the repo). Known sections: §3.3 command palette, §4.7 timing anomalies, §4.14 broadcasts, §4.23 compliance/DSR, §4.25 dashboard metrics/queues, §4.27 moderation, §4.28 live assessments/pause, §4.29 health pings, §4.30 integrity checks, §5.4 digests, §6 data model. The admin panel shipped in phases (Phase 1→§6, 3→§4.28, 5→§4.14, 7→§4.23, 8→§4.25/4.27/4.29/4.30) — see [admin-portal.md](admin-portal.md) §8.0. Each portal doc's §8 adds local requirement IDs (`STU-/TCH-/PAR-/ADM-R#`) with status tags and file evidence.
