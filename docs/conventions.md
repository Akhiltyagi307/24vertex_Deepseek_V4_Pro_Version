# 24Vertex repo conventions

A living document of repo-wide style and structure conventions. Add a new
section when a recurring code-review correction surfaces.

## File size

A TypeScript/TSX file over **500 lines** is past the unit of cognitive
review. Split along a natural boundary before merging the change that
crosses the line. Common axes:

- **Per-stage** for pipelines (`pipeline/{preflight,model-call,repair,persist}.ts`).
- **Per-subject** for curriculum-heavy modules (`{math,physics,…}.ts`).
- **Per-tab** or **per-section** for large views.
- **Per-handler** for big multi-job route handlers.

Existing backlog (move incrementally, one file per PR):

| File | LOC | Suggested split |
|---|---:|---|
| `src/lib/practice/practice-generation-pipeline.ts` | 2 038 | per-stage under `pipeline/` |
| `src/lib/student/practice-grading-pdf-visual.tsx` | 1 703 | per-visual-kind |
| `src/lib/practice/visuals/templates/index.ts` | 1 687 | per-subject |
| `src/components/student/student-performance-view.tsx` | 1 368 | per-tab |
| `src/lib/student/practice-grading-pdf-document.tsx` | 1 142 | per-section |
| `src/lib/practice/ai-grade-practice-test.tsx` | 1 217 | UI vs grading loop |
| `src/components/student/practice/visuals/renderers/physics-diagram.tsx` | 1 070 | per-renderer-kind (data-driven; OK to leave) |
| `src/components/student/practice/practice-test-wizard.tsx` | 971 | finish in-progress split |
| `src/lib/practice/visuals/schemas.ts` | 947 | per-visual-kind |
| `src/components/student/student-reports-view.tsx` | 915 | per-tab / per-card |
| `src/components/student/practice/practice-test-session.tsx` | 803 | finish in-progress split |
| `src/components/teacher/teacher-assignments-submissions-hub.tsx` | 751 | per-pane / per-tab |
| `src/components/student/qna-logs/student-qna-logs-view.tsx` | 745 | extract filter / list / detail |
| `app/teacher/(protected)/assignments/teacher-assignments-manager.tsx` | 731 | per-tab / per-modal |
| `app/api/internal/practice/run-jobs/route.ts` | 643 | per-job-handler under `src/lib/practice/jobs/handlers/` |
| `src/components/student/dashboard-subject-card.tsx` | 672 | extract progress-bar / chart sub-components |
| `src/components/student/practice/practice-rich-answer-editor.tsx` | 644 | extract toolbar / image-upload sub-components |

When splitting: keep the original file as a thin re-export shim until
consumers migrate, so the diff stays small and imports continue to work.

## Server actions

- **`actions/` folder** with `index.ts` for any action set over ~150 LOC
  that's likely to grow.
- **`actions.ts`** is fine for small (<100 LOC), stable action sets.
- Server-only files must `import "server-only"` at the top.
- Server actions are named imperatively (`createSubscriptionAction`,
  `selectParentStudentAction`); return `{ ok: true }` / `{ error: string }`
  shapes from form-action paths so React's `useFormState` consumers don't
  need to discriminate by truthy/falsy.

## CSRF / Origin gates

Mutating routes under `app/api/{role}/**`, `app/api/feedback`, and
`app/api/contact` go through a per-prefix proxy guard that calls
`originAllowed()` from `src/lib/security/origin-guard.ts`. New mutating
prefixes need a guard wired into `proxy.ts` — don't rely solely on
SameSite=Lax cookies.

## Recharts / heavy viz libs

Recharts, Plotly, Three.js, Mafs, Mermaid, Tiptap, Monaco, pdfjs,
tesseract, smiles-drawer, function-plot — each is multi-hundred-KB
gzipped. Always load via `next/dynamic({ ssr: false, loading: () =>
<Skeleton /> })`. The pattern lives at:

- `src/components/blocks/feature-performance-radial.tsx` (marketing).
- `src/components/charts/subject-topic-radar-chart.tsx` (dashboard).
- `src/components/student/practice/visuals/renderers/statistics-chart.tsx`
  (practice).

The skeleton's dimensions must match the rendered chart to prevent CLS.

## Service-role Supabase client

`@/lib/supabase/admin` (`createServiceRoleClient`) bypasses RLS and must
only be imported from server-side files in the allowlist defined in
`eslint.config.mjs#vertex24-service-role-import-boundary`. For
`unstable_cache` work-units where there's no request cookie, prefer
`@/lib/supabase/anon` (`createAnonClient`) with a scoped RLS policy
(active-only, public-only) rather than reaching for service-role.

## Database migrations

- Two Supabase projects must stay in sync; every change applies to both.
  CI's `check-migration-drift.mjs` enforces this when secrets are present.
- New indexes on hot tables (`tests`, `profiles`, `questions`,
  `student_answers`, `assignment_submissions`, `billing_events`,
  `email_log`) MUST use `CREATE INDEX CONCURRENTLY`. Lint enforces.
- File naming: `<14-digit timestamp>_<descriptive_name>.sql`. Two
  migrations with the same descriptive name within 24h fail the lint —
  pick a more specific suffix.
- Once applied to either project, the filename is locked. Never rename.

## Type-safety hygiene

- Zero `@ts-ignore`. Zero `@ts-expect-error` (1 legacy exception).
- `as any` is banned in production code.
- `as unknown as <T>` is a smell — usually means the surrounding declaration
  isn't typed. Prefer typing the source (`vi.fn<...>()`, helper return types)
  over casting at every call site.
- Test files: when narrowing `vi.fn().mock.calls`, declare the mock with
  its full type signature once at the top of the file rather than casting
  per use.

## ESLint guards

- `no-restricted-syntax` blocks raw `<img>` in `app/(public)/**` and
  `src/components/marketing/**` — use `next/image` for AVIF/WebP, lazy
  loading, CLS prevention, and CSP coverage.
- `no-restricted-imports` blocks `@/lib/supabase/admin` outside the
  service-role allowlist.
- `@typescript-eslint/no-floating-promises` is type-aware-enabled — every
  promise must be awaited, voided, or chained.

## CSP / security headers

- `'unsafe-inline'` is removable from `script-src` in production via
  `PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK=1`. See
  `docs/security/csp.md`.
- New image origins go in BOTH `src/lib/security/csp.ts` (CSP `img-src`)
  AND `next.config.ts#images.remotePatterns` (Next image optimizer).
- COOP and CORP are `same-origin`. COEP is intentionally absent.
