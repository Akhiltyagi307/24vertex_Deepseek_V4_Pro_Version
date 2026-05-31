# 24Vertex — Portal Documentation

**Snapshot:** 2026-05-31 · branch `claude/festive-goldberg-e79b4b` @ `8f69969`.

Detailed, LLM-oriented documentation of the 24Vertex platform (NCERT practice-test product, grades 6–12) — what each portal does, how it benefits each party, and a PDR-style spec of the **current code state** so an agent can plan next steps.

## Read order
1. **[platform-foundations.md](platform-foundations.md)** — shared systems (stack, auth, data model, AI pipelines, billing, notifications, security/compliance). Read this first; the portal docs reference it instead of repeating it.
2. The four portal docs:

| Doc | Primary user | Highlights |
|---|---|---|
| [student-portal.md](student-portal.md) | Student | AI practice generation, timed test-taking, auto-grading, AI doubt-tutor, performance analytics, assignments, streaks |
| [teacher-portal.md](teacher-portal.md) | Teacher | Verification gate, roster, assignment fan-out, submissions, cohort/topic analytics |
| [parent-portal.md](parent-portal.md) | Parent/guardian | Child linking (+ consent), oversight dashboards, reports/doubt review, billing-on-behalf |
| [admin-portal.md](admin-portal.md) | Staff/operator | Users, orgs, curriculum, AI governance, live-assessment ops, billing/reconciliation, comms, compliance, system/SQL, audit |

## Document structure (each portal doc)
1. Plain-language overview + how it fits the platform.
2. **[Technical]** current setup (routes, tables, APIs, data flows).
3. Capabilities (feature-by-feature: plain + technical).
4. Benefits to the primary user, and to every other party.
5. Honest limitations.
6. **§8 PDR-style specification** — state machines, numbered requirements with status, data contracts/invariants, telemetry, and ordered next-step hooks.

## Status legend (used in every §8)
- `[IMPLEMENTED]` — present & exercised in code
- `[PARTIAL]` — present but incomplete / needs hardening
- `[GAP]` — not built
- `[PLANNED]` — designed, not started

Requirement IDs are stable and portal-scoped: `STU-R#`, `TCH-R#`, `PAR-R#`, `ADM-R#`. Canonical PDR cross-refs (`PDR §x.y`) point to the master spec; see [platform-foundations.md](platform-foundations.md) §9 for the section map.

## Accuracy note
The §8 status tags were re-verified against the code at the snapshot commit above (superseding the older `docs/audit/*` review of 2026-05-17). When acting on a tag, re-confirm against current code — and update the tag if it has drifted.

> **Note:** `docs/` is gitignored in this repo. These files are force-added (`git add -f`) so agents/checkouts can see them; new files added here later are not auto-tracked.
