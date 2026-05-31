# 24Vertex — Parent Portal

**Snapshot:** 2026-05-31 · branch `claude/festive-goldberg-e79b4b` @ `8f69969`. The §8 status tags were re-verified against current code on this date (superseding the older `docs/audit/*` snapshot of 2026-05-17).
**Product:** 24Vertex (technical slug `vertex24`; legacy `eduai`)
**Audience for this doc:** mixed. **[Plain]** sections are for any human reader (parents, business, support). **[Technical]** sections are dense and name concrete files, tables, routes, and flows for engineers and LLMs.
**Scope:** `app/parent/**`, `app/api/parent/**`, `src/lib/parent/**`, `src/lib/auth/link-parent-rpc-errors.ts`, and the parent-linking migration/RPCs.

---

## 1. What the Parent Portal is — [Plain]

The Parent Portal lets a parent or guardian follow their child's learning on 24Vertex without interfering with it. After linking to their child, a parent can:

- **See the child's progress** — subject and topic mastery, trends, strengths and weak spots.
- **Read the child's test reports** — the same graded results the student sees.
- **Review the child's AI doubt history and answered questions** (oversight of what's being asked and learned).
- **Track assignments** the teacher set and whether they're done.
- **Manage the subscription / payment** for the child's plan.
- **Get notifications** about reports, assignments, and plan usage.

It is primarily an **oversight and support** portal: parents observe and pay, students do the work.

---

## 2. How the Parent Portal fits the wider platform — [Plain]

- A parent creates their own account, then **links to their child** using a short code the child has (or by matching the child's registered parent email).
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
- `app/parent/open-report/route.ts` is a server-side redirect that opens a specific child's report (UUID-validated inputs).

### 3.3 The linking flow (security-critical)
- `app/parent/link-child` accepts the child's link code. The student's 8-char `studentLinkCode` (format `XXX12345`, on `profiles`) identifies the child.
- A successful link writes a `parent_student_links` row (`status` `pending`→`active`). Linking errors are mapped via `src/lib/auth/link-parent-rpc-errors.ts` and the action writes an audit row.
- **Consent dimension:** `parental_consents` records DPDP-style guardian consent (`consentMethod`, `consentTextV`, `grantedAt`/`revokedAt`, `evidenceUrl`) — relevant for minors.
- **Resolved (was audit P1):** migration `20260525150000_parent_link_student_confirmation.sql` no longer auto-fills a blank `parent_email`. When the student's `parent_email IS NULL`, the link is created with status `pending` (requires student in-app confirmation); only a matching `parent_email` yields an immediate `active` link.

### 3.4 Data model — tables this portal reads/writes
| Table | Role in the parent portal |
|---|---|
| `profiles` | Parent record (`role='parent'`, `parentName`, `parentEmail`); also the linked child's profile (read). |
| `parent_student_links` | Parent↔child edges (`status` pending/active, `linkedAt`). Unique per (parent, student). The core authorization edge. |
| `parental_consents` | Guardian consent records for minors (method, version, granted/revoked, evidence). |
| `tests`, `test_reports`, `student_answers`, `questions` | The child's tests + graded reports + answered-question log the parent reviews (scoped to linked children). |
| `performance_tracker` | Per-(child, topic) mastery the parent dashboard visualises. |
| `doubt_conversations` / `doubt_messages` | The child's AI tutor history, surfaced as QnA/doubt oversight. |
| `assignments` / `assignment_submissions` | Teacher-set work + the child's completion status. |
| `subscriptions` / `usage_periods` / `payments` | Plan + quota + payment records the parent manages on the child's behalf. |
| `notifications` | Parent's in-app notifications (report ready, assignment, usage thresholds). |

### 3.5 Routes (pages)
- `app/parent/link-child` — enter the child's code to link.
- `app/parent/select-student` — choose / switch the active child.
- `app/parent/open-report` — server redirect into a specific report.
- Under `app/parent/(portal)/`: `dashboard`, `performance`, `reports`, `qna-logs`, `doubt-chat`, `assignments`, `notifications`, `settings`, `subscription`.

### 3.6 Server actions & API routes
- **Linking/selection:** `link-child` action (+ RPC error mapping), `select-student/actions.ts` (cookie set + audit).
- **Parent API** (`app/api/parent/`): `assignments` (+ `open-indicator`), `notifications` (+ `[id]`, `read-all`, `unread-count`), `qna-logs` (+ `[answerId]`, `nav`).
- **Billing:** the parent can drive checkout/management for the child's `subscription` through the shared billing routes (`app/api/billing/**`).
- Entitlements for the active child are read via `getCachedEntitlementsForProfile(childProfileId)` (caller enforces the link).

### 3.7 Cross-cutting
- **Audit discipline:** linking writes audit rows; selection/open-report auditing is a known enhancement area.
- **Notifications** mirror the student's important events to the parent.
- **Security:** `httpOnly` active-child cookie, server-side `assertParentActiveLink`, origin gating, rate limiting.

---

## 4. Capabilities, feature by feature

### 4.1 Link to a child (and switch between children)
- **[Plain]** The parent enters the child's code once; from then on the child appears in their portal. Parents with several kids can switch between them with one tap.
- **[Technical]** `link-child` → `parent_student_links` (audited). `select-student` sets an `httpOnly` active-child cookie; every load re-verifies via `assertParentActiveLink`. Multi-child supported.

### 4.2 Progress dashboard
- **[Plain]** A clear overview of how the child is doing across subjects — what's mastered, what's weak, and the direction of travel.
- **[Technical]** `(portal)/dashboard` + `performance` read `performance_tracker` for the active child; charts via Recharts.

### 4.3 Read the child's reports
- **[Plain]** The parent can open any graded test the child took and read the score, the model answers, and the feedback — the same report the student gets.
- **[Technical]** `(portal)/reports` over `tests`+`test_reports`; deep-link via `open-report/route.ts`.

### 4.4 Oversee doubts & answered questions
- **[Plain]** Parents can review what the child has been asking the AI tutor and how they answered practice questions — useful for spotting struggles or misuse.
- **[Technical]** `(portal)/doubt-chat` + `qna-logs` read `doubt_conversations`/`doubt_messages` and `student_answers` for the active child, paginated with prev/next nav.

### 4.5 Track assignments
- **[Plain]** See what the teacher assigned and whether the child has done it (and on time).
- **[Technical]** `(portal)/assignments` + `app/api/parent/assignments` read `assignment_submissions` (status/score/`isLate`); `open-indicator` flags outstanding work.

### 4.6 Manage the subscription & payments
- **[Plain]** The parent can see how many tests and AI credits remain this period, upgrade the plan, and handle payment — taking the money side off the child.
- **[Technical]** `(portal)/subscription` reads the child's entitlement snapshot (plan, `testsLeft`, `tokensLeft`, trial/status); checkout/management via Razorpay (`app/api/billing/**`). Records in `subscriptions`/`usage_periods`/`payments`.

### 4.7 Notifications & settings
- **[Plain]** Get alerts (report ready, new assignment, nearing the monthly limit) and manage profile + notification preferences + linked children.
- **[Technical]** `(portal)/notifications` + API; `(portal)/settings` (profile / notifications / linked-children sections).

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

- **Parent-linking blank-`parent_email` hazard is resolved** (migration `20260525150000_parent_link_student_confirmation.sql`): a blank student `parent_email` now yields a `pending` link requiring student confirmation, not an auto-active guardian. Optional further hardening: longer link code + per-student attempt caps.
- The active-child cookie max-age is now **90 days** (was ~400; `select-student/actions.ts` + `open-report/route.ts`), and access is still re-checked server-side via `assertParentActiveLink`.
- `select-student` / `open-report` **audit-log coverage** is thinner than the linking flow.
- Mutating `/api/parent/*` routes historically lacked an **Origin/CSRF gate**.
- The parent view is **read-oriented**: parents cannot author or take tests, edit the child's answers, or message teachers in-portal (by design).
- Link-code normalisation (upper-casing) and `.strict()` schema hardening are tracked refinements.

---

## 8. PDR-style specification — current code state (for LLM planning)

> **How to read this section.** Mirrors the canonical *Product Design Requirements* (PDR v3.0, referenced inline as `PDR §x.y`). Parent linking is core PDR (`supabase/migrations/...eduai_parent_linking.sql`); guardian consent intersects compliance **PDR §4.23**. Each requirement has a local ID (`PAR-R#`), a **Status** in `[BRACKETS]`, file **evidence**, and (for gaps) a **Hook:** pointer.
> **Status legend:** `[IMPLEMENTED]` · `[PARTIAL]` · `[GAP]` · `[PLANNED]`.

### 8.1 Entity state machines

**Parent↔child link** (`parent_student_links.status`, persisted `src/db/schema/profiles.ts`)
```
(parent submits child's studentLinkCode) ──▶ pending ──▶ active (linkedAt)
                                                   │
                                       (support/parent revoke) ──▶ removed
INVARIANT: unique(parent_id, student_id)
AUTH: every parent page re-checks the active edge server-side via assertParentActiveLink
      (the active-child cookie is convenience, NOT the authority)
RESOLVED (was audit P1): blank student parent_email ⇒ link created as 'pending'
      (student must confirm), NOT auto-active (migration 20260525150000_parent_link_student_confirmation.sql).
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
| PAR-R1 | Parent links to a child using the child's 8-char `studentLinkCode`; relationship audited. | `[IMPLEMENTED]` | `app/parent/link-child`, `parent_student_links`, `link-parent-rpc-errors.ts` | core |
| PAR-R2 | Parent may link multiple children and switch the active child. | `[IMPLEMENTED]` | `select-student/actions.ts` (httpOnly cookie) | core |
| PAR-R3 | All access to a child's data re-verified server-side per request. | `[IMPLEMENTED]` | `assertParentActiveLink` | core |
| PAR-R4 | Read child's performance, reports, answered-question log, doubt history. | `[IMPLEMENTED]` | `(portal)/{performance,reports,qna-logs,doubt-chat}` over `performance_tracker`/`tests`/`test_reports`/`student_answers`/`doubt_*` | core |
| PAR-R5 | Track assignments + completion/late state. | `[IMPLEMENTED]` | `(portal)/assignments`, `app/api/parent/assignments` (+ open-indicator) | core |
| PAR-R6 | Manage child's subscription/plan/payments and see remaining quota. | `[IMPLEMENTED]` | `(portal)/subscription`, `getCachedEntitlementsForProfile`, `app/api/billing/**` | core |
| PAR-R7 | Notifications mirror the child's key events; manage profile/notif prefs/linked children. | `[IMPLEMENTED]` | `(portal)/notifications` + API, `(portal)/settings` | core |
| PAR-R8 | Guardian consent recorded for minors (DPDP-style). | `[IMPLEMENTED]` | `parental_consents` | §4.23 |
| PAR-R9 | Block link auto-fill when student `parent_email` is blank; require student confirmation. | `[IMPLEMENTED]` | `20260525150000_parent_link_student_confirmation.sql`: blank `parent_email` ⇒ link status `pending` (student confirms); matching email ⇒ `active` | core (security) |
| PAR-R10 | Bounded active-child cookie max-age + server re-check. | `[IMPLEMENTED]` | now 90 days (`select-student/actions.ts`, `open-report/route.ts`); `assertParentActiveLink` re-checks each load | core (security) |
| PAR-R11 | Audit `parent.student_selected` / `parent.report_opened`. | `[PARTIAL]` | linking audited; select/open not | core (observability) |
| PAR-R12 | Origin/CSRF gate on mutating `/api/parent/*`; link-code normalisation; `.strict()` schemas. | `[PARTIAL]` | CSRF done via `parentProxyGate` (`src/lib/parent/proxy-guard.ts`); link-code upper-casing + blanket `.strict()` on parent action schemas not separately confirmed | core (security/validation) |
| PAR-R13 | Parent is read/oversight only — cannot take tests, edit answers, or author content. | `[IMPLEMENTED]` (by design) | scope of `app/parent/**` | core |

### 8.3 Data contracts & invariants (enforced)
- **One link row per (parent, student)** — `unique(parent_id, student_id)` on `parent_student_links`.
- **Server-authoritative access** — child-scoped reads gate on a live `active` link, not on the cookie.
- **Entitlements for a non-self profile** — `getCachedEntitlementsForProfile(childId)` requires the caller to have proven the link first.
- **UUID-validated deep links** — `open-report/route.ts` validates `studentId`/`testId` as UUIDs before redirect.

### 8.4 Telemetry & observability
- Linking writes audit rows (best discipline in the codebase); success/failure ratio metric is `[GAP]`.
- Selection/open-report audit + Sentry spans on dashboard are `[PARTIAL]`.

### 8.5 Known gaps & next-step hooks (ordered by risk)
1. **PAR-R9 blank-email link hazard** `[IMPLEMENTED]` — resolved by `20260525150000_parent_link_student_confirmation.sql` (blank email ⇒ `pending` + student confirmation). Optional: lengthen the link code + per-student attempt cap.
2. **PAR-R12 CSRF + normalisation + strict schemas** `[PARTIAL]` — CSRF done (`parentProxyGate`). Remaining **Hook:** `.transform(s=>s.toUpperCase())` on the link-code schema; `.strict()` on parent action schemas.
3. **PAR-R10 cookie hardening** `[IMPLEMENTED]` — max-age reduced to 90d + server re-check in place. Optional: clear the cookie on link revoke (`unlinkParentFromStudent`).
4. **PAR-R11 select/open audit** `[PARTIAL]` — **Hook:** write `audit_log` entries on select-student and open-report; add a link success/failure counter.
