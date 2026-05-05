# Follow-up prompts for Phases 6.2 and 6.3

These two items were called out in [PATH_TO_95.md §8](PATH_TO_95.md) as deliberately deferred from the main roadmap. Each warrants its own focused PR (≈1+ day) and its own session.

The prompts below are self-contained: they include full context, file paths, acceptance criteria, and patterns to follow. Paste either one into a fresh Claude Code session at the repo root.

---

## Prompt 6.2 — Type-aware ESLint sweep (`no-floating-promises` + `no-misused-promises`)

```
You are continuing work on EDU-AI, a Next.js 16 / React 19 / TypeScript 5 (strict) project. A frontend code review (FRONTEND_CODE_REVIEW.md) produced the PATH_TO_95.md improvement roadmap, which has shipped end-to-end on the main branch. Weighted code-quality score landed at ~95. This PR closes one of the deliberately-deferred follow-up items from PATH_TO_95.md §8.

## Goal

Enable @typescript-eslint/no-floating-promises and @typescript-eslint/no-misused-promises at error level, then sweep every violation across the codebase. After this PR, `pnpm run lint` runs type-aware ESLint and catches floating promises at PR time.

## Why it matters

A floating Promise that rejects becomes an unhandled rejection in Node/Next runtime, which Sentry reports as an error. The team has had a few of these in production (silent failures in admin actions). The rule catches them at lint time.

These rules were not bundled into Phase 5 because:
- They're type-aware, so they run 5–10× slower than the current non-type-aware lint (the Phase 5 ratchet kept lint under 30 s; type-aware will push to 60–90 s on cold runs).
- They typically fire in dozens of legitimate fire-and-forget patterns that need per-site judgment (annotate-with-`void` vs await-and-handle).

## Read these first

1. eslint.config.mjs — current flat config; we'll add a new block.
2. package.json (lint script at line ~20) — currently `eslint --max-warnings=0`; we'll add `--cache`.
3. tsconfig.json — type-aware lint needs `parserOptions.project` pointing here.
4. PATH_TO_95.md §8 "What's still left for separate PRs" — the framing.

The codebase already uses `void` deliberately in ~135 places; the team is aware of the floating-promise concern. Don't reflexively rewrite those — the sweep is about new findings, not existing fixtures.

## Implementation outline

### 1. Add the rules to eslint.config.mjs

Add a new flat-config block (after the existing service-role-boundary block):

    {
      name: "eduai-type-aware",
      files: ["**/*.{ts,tsx}"],
      ignores: ["scripts/**", "tests/e2e/**", "**/*.cjs", "**/*.mjs"],
      languageOptions: {
        parserOptions: {
          project: ["./tsconfig.json"],
          tsconfigRootDir: import.meta.dirname,
        },
      },
      rules: {
        "@typescript-eslint/no-floating-promises": ["error", {
          ignoreVoid: true,
          ignoreIIFE: true,
        }],
        "@typescript-eslint/no-misused-promises": ["error", {
          checksConditionals: true,
          checksVoidReturn: { attributes: false },
        }],
      },
    },

The `checksVoidReturn.attributes: false` exception is critical — without it, the rule flags every `<Button onClick={async () => ...} />`, which is idiomatic React.

### 2. Update the lint script for caching

eslint.config.mjs is now type-aware and will be slow on cold runs. In package.json, change the lint script:

    "lint": "eslint --max-warnings=0 --cache --cache-location node_modules/.cache/eslint/"

(`node_modules/.cache/` is already gitignored.)

### 3. Run `pnpm run lint` and triage every finding

Categorize each into one of three buckets:

**FIX** — most common, real bug:
- `someAsync()` → `await someAsync()` if inside an async function and the result matters.
- `.then(...)` chains that swallow errors → add `.catch(reportError)` or convert to await/try-catch.
- Server actions called from client components without await — almost always a bug.

**ANNOTATE** — fire-and-forget by design:
- Sentry: `void Sentry.captureException(...) // fire-and-forget: telemetry`
- Toast: `void toast.success(...) // fire-and-forget: UI feedback`
- web-vitals: `void track(metric) // fire-and-forget: web-vitals`
- Realtime cleanup: `void channel.unsubscribe() // fire-and-forget: best-effort cleanup`

Every annotation MUST include a one-line comment naming the reason.

**INSPECT CAREFULLY**:
- `setTimeout(async () => ...)` — wrap the async body in a try/catch; the timer can't catch rejections.
- `addEventListener("...", async (e) => ...)` — same.
- Anything inside a `useEffect` cleanup return — if the cleanup is async, the unmount path won't await; usually need to either fire-and-forget intentionally or restructure.

### 4. Existing `void` audit

Spot-check the existing ~135 `void` sites. Pattern:
- `void someSideEffectingCall()` without comment → leave alone unless clearly wrong.
- `void someServerAction()` (returns data we should be using) → suspicious; investigate and either await or document why fire-and-forget.

Don't make this an exhaustive audit. Just don't introduce regressions.

### 5. Performance sanity check

After the sweep, time `pnpm run lint` cold:

    rm -rf node_modules/.cache/eslint/
    time pnpm run lint

Target: under 90 s on a clean cache. If it's slower, scope the rules narrower (e.g., add `files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"]` and exclude the `tests/` glob entirely from type-aware lint — they're noise-prone).

## Constraints

- No `eslint-disable` directives without a `-- reason` comment.
- pnpm test must remain at 545 / 11 / 0.
- pnpm exec tsc --noEmit must remain clean.
- Don't introduce changes outside the scope of these two rules. If you spot unrelated bugs, file them as TODO comments or follow-up issues; don't bundle.

## Acceptance criteria

- [ ] Both rules fire as `error` and `pnpm run lint` exits 0.
- [ ] Every annotated `void` has an inline `// reason: ...` comment.
- [ ] No new `eslint-disable` directives without `-- reason` justification.
- [ ] `pnpm run lint` cold-cache time < 90 s.
- [ ] All gates green: lint, test, tsc.
- [ ] Update PATH_TO_95.md §8 "What's still left" — strike item #1, add a row to the Phase 6 activation table noting this shipped.
- [ ] PR description lists each meaningful refactor (not annotations) so a reviewer can spot-check the dangerous ones.

## Out of scope

- @typescript-eslint/strict-boolean-expressions (separate, much larger PR).
- @typescript-eslint/await-thenable (could pair with this; OK to include if findings <10).
- Rewriting the existing ~135 `void` sites unless one is clearly wrong.

## Estimated effort

1 day. Most time is sweeping findings, not configuring the rule. Expect 50–150 findings; rough split: 30% genuine bugs to fix, 70% legitimate fire-and-forget that needs `void` + reason.
```

---

## Prompt 6.3 — JSX decomposition of giant student components

```
You are continuing work on EDU-AI, a Next.js 16 / React 19 / TypeScript 5 (strict) project. A frontend code review (FRONTEND_CODE_REVIEW.md) produced the PATH_TO_95.md improvement roadmap, which has shipped end-to-end on the main branch. Weighted code-quality score landed at ~95. This PR closes the largest deliberately-deferred follow-up item from PATH_TO_95.md §8.

## Goal

Decompose the three giant student components by extracting JSX subtrees into focused child components. Phase 1 already extracted the lifecycle plumbing (hooks, reducers); this PR is the JSX split that Phase 1 deliberately left for a separate session.

After this PR each target file is under ~800 LOC and each extracted child is under 350 LOC, with a focused render test.

## Why it matters

- These three files exceed 1,300–1,950 LOC each — the biggest single contributors to the "Component Design" dimension scoring below 94.
- Phase 2 deferred component-render tests for these because the surface area was too big to test fast. After JSX split, each child gets its own focused render test.
- Future feature work in practice / doubt-chat surfaces (incident reports, parent-portal embeds) needs cleaner seams.

## Files in scope

| File | Current LOC | Already extracted (Phase 1) | What's left in the file |
|------|------:|-----------------------------|-------------------------|
| src/components/student/practice/practice-test-session.tsx | 1,927 | 6 hooks (timer, draft-persist, tab-blur, network, battery, channel), storage helpers | Question card, navigation Sheet (line ~995), finish/exit AlertDialog (line ~1469), hint Drawer, top app bar, bottom tab bar, resume modal |
| src/components/student/practice/practice-test-wizard.tsx | 1,943 | wizard-draft-state reducer (5 of 12 fields collapsed), draft-persist hook | Step 1 subject picker, Step 2 chapter selection, Step 3 config form, Step 4 review, tracker selector (uses useState bulk-add/remove + toast-undo), summary footer |
| src/components/student/doubt/doubt-chat-view.tsx | 1,372 | Streaming hook (in src/lib/ai/) | Sidebar (history list), message thread, composer, image picker dialog, model picker popover |

The originally-listed fourth file student-dashboard-view.tsx (538 LOC) and student-profile-settings-form.tsx (690 LOC) are **already small enough** after Phase 1 work — skip them unless a clear seam invites further extraction.

## Patterns to follow

Phase 1 established two patterns. Reuse them.

### Pattern A — Reducer-backed parent, dumb children

See:
- src/components/student/performance/performance-state.ts (the reducer)
- src/components/student/performance/ (how parent dispatches into focused children)

This is the model for practice-test-session and practice-test-wizard.

Parent owns:
- All useState / useReducer
- All side-effect hooks (extracted in Phase 1)
- The dispatch / callback bag

Children receive:
- Read-only props (state slices, derived flags)
- Callbacks (typed; not raw setters — never `setX: Dispatch<SetStateAction<X>>` as a prop)
- No direct hook access except UI primitives (useId, useFormStatus)

### Pattern B — Server-component-friendly leaves

If a leaf doesn't need event handlers or hooks, leave it without "use client". Some sub-pieces (review summary cards, footer chips) are pure render and benefit.

### Pattern C — No defensive forwardRef

Don't forwardRef speculatively. Most of these children don't need it.

## Target shapes

After decomposition:

    src/components/student/practice/
    ├── practice-test-session.tsx          (≈600 LOC, orchestration)
    ├── practice-test-session/
    │   ├── question-card.tsx              (200–350 LOC)
    │   ├── question-nav-sheet.tsx         (150–200 LOC)
    │   ├── finish-confirm-dialog.tsx      (80–120 LOC)
    │   ├── hint-drawer.tsx                (100–150 LOC)
    │   ├── session-app-bar.tsx            (80–120 LOC)
    │   ├── session-tab-bar.tsx            (60–100 LOC)
    │   └── __tests__/
    │       ├── question-card.test.tsx
    │       ├── question-nav-sheet.test.tsx
    │       └── finish-confirm-dialog.test.tsx
    ├── practice-test-wizard.tsx           (≈400 LOC, orchestration)
    └── practice-test-wizard/
        ├── step-subject.tsx               (~200 LOC)
        ├── step-chapters.tsx              (~250 LOC)
        ├── step-config.tsx                (~250 LOC)
        ├── step-review.tsx                (~150 LOC)
        ├── tracker-selector.tsx           (~250 LOC)
        ├── wizard-summary.tsx             (~120 LOC)
        └── __tests__/
            └── ...

    src/components/student/doubt/
    ├── doubt-chat-view.tsx                (≈500 LOC, orchestration)
    └── doubt-chat-view/
        ├── conversation-sidebar.tsx       (~200 LOC)
        ├── message-thread.tsx             (~250 LOC)
        ├── chat-composer.tsx              (~250 LOC)
        ├── model-picker-popover.tsx       (~120 LOC)
        └── __tests__/
            └── ...

## Implementation outline

### 1. One component per commit (or per PR)

Do NOT decompose all three in a single commit. Split into three commits at minimum, ideally three separate PRs:

1. practice-test-session JSX split — biggest win; lifecycle plumbing already extracted
2. practice-test-wizard JSX split — second; reducer is partial (decide whether to expand it for tracker-set or keep that as useState)
3. doubt-chat-view JSX split — smallest; cleanest natural seams

Each commit must green-pass:
- pnpm run lint
- pnpm test
- pnpm exec tsc --noEmit
- pnpm run bundle:budget (the per-route gzipped first-load JS gate)
- The full Playwright suite

### 2. Decomposition method per parent

a. **Identify natural seams.** Look for big JSX subtrees that are:
   - Wrapped in `<Sheet>` / `<Dialog>` / `<Drawer>` / `<AlertDialog>` (obvious split points)
   - State-machine bound (e.g., a confirm-finish dialog with its own opens/closes)
   - Repeated in multiple positions (extract once, render twice)

b. **Identify the prop boundary.** What does the child need? List those as named props. Avoid passing the whole reducer state down — pass just the slice.

c. **Move the JSX.** Keep imports tight in the child; the parent re-exports nothing.

d. **Add a focused render test.** Use the existing test infrastructure:
   - For hooks: src/test/render-hook.tsx (raw createRoot + act helper)
   - For components: same raw createRoot + act pattern; mount, query DOM, fire one interaction, assert
   - Mock the minimum needed via the mock factory pattern in tests/factories/

   Each child test:
   - Renders with mocked-minimal props
   - Asserts initial DOM
   - Fires one user interaction, asserts callback fired or DOM changed

e. **Manual smoke test.** Run pnpm run dev → click through the surface. Verify parity. The Phase 6 visual baselines cover marketing/login/legal pages, not authed surfaces, so this manual pass is load-bearing.

### 3. What NOT to extract

- Single-use 30-line subtrees. The "150-line minimum" heuristic from Phase 1 is right.
- Components that are mostly conditional rendering of one of three states — keep those inline; easier to read together.
- Anything that requires inventing a context just to share state across two siblings. That's a smell that the seam is wrong; pick a different one.

### 4. Wizard-specific note: tracker-selector

practice-test-wizard.tsx has 5 of 12 state fields collapsed into wizard-draft-state.ts. The remaining 7 are tracker-related (bulk-add/remove + toast-undo semantics). Decide upfront:

**Option A (recommended):** Extend wizard-draft-state with tracker actions (`addTracker`, `removeTracker`, `bulkAddTrackers`, `undoLastTrackerOp`). Pull tracker history into the reducer's state. Costs ~150 LOC in the reducer, simplifies the parent.

**Option B:** Keep tracker-set as useState in the parent; pass `selectedTrackers` and callbacks into `<TrackerSelector>`. Cheaper but the parent stays mixed-paradigm.

Document which you chose in the commit message.

### 5. Files to also touch

- vitest.config.ts — coverage thresholds may need adjusting as new files come in. Current config sets src/lib/** and src/hooks/** to 70%; consider adding src/components/student/practice/** and src/components/student/doubt/** after the split if you want testing to mature.
- Bundle budget: scripts/bundle-budget.mjs gates app/student/practice/** first-load JS. Decomposition shouldn't change first-load JS — it's the same code in more files. Verify with pnpm run bundle:budget before/after.

### 6. Constraints

- TypeScript strict-mode invariants must be preserved: every prop typed, no `any`, no `as unknown as` shortcuts.
- pnpm test must stay at 545 (or grow) with no failures or skips.
- No new `motion/react` imports — Phase 0 settled the animation library.
- Don't change layout/styling in this PR. Pure refactor. If you spot styling issues, file them as TODO comments.

## Acceptance criteria

Per target component:

- [ ] Parent file is **under ~800 LOC**.
- [ ] Each extracted child is **under 350 LOC**.
- [ ] Each extracted child has at least one focused render test.
- [ ] pnpm run lint, pnpm test, pnpm exec tsc --noEmit, pnpm run bundle:budget all green.
- [ ] Manual smoke: open the surface in pnpm run dev, drive the golden path, verify parity (no visual or behavioral regression).
- [ ] Update PATH_TO_95.md §8 — Component Design dimension's "After (actual)" can move from ~90 toward 94. Strike or refine the corresponding §8 follow-up item.
- [ ] PR description includes a before/after LOC table per file.

## Out of scope

- Adding new features to any of these surfaces.
- Migrating away from motion/react (Phase 0 settled this).
- Changing layout/styling.
- i18n wrapping (separate PR per PATH_TO_95.md §5).
- The student-dashboard-view (538) and student-profile-settings-form (690) — already small enough.

## Estimated effort

- practice-test-session: 1.5–2 days
- practice-test-wizard: 1–1.5 days (less if you choose Option B for tracker state)
- doubt-chat-view: 1 day

Total: 3.5–4.5 days if doing all three; recommend three separate PRs to keep diffs reviewable.
```

---

## Notes for the executor

Both prompts assume:

- The repo is at the same point this branch shipped — Phases 0–5 + Phase 6.1/6.4/6.6 done.
- All gates currently green (`pnpm run lint`, `pnpm test`, `pnpm exec tsc --noEmit`).
- The follow-up section in [PATH_TO_95.md §8](PATH_TO_95.md) already reserves a slot for these items; updating that section is part of each PR's acceptance criteria.

If executing 6.2 and 6.3 in parallel, do **6.2 first** — the JSX decomposition in 6.3 will create new files that should pass type-aware lint from the start, rather than getting swept after the fact.
