# Closed Learning Loop — Phase 3 (Mistake-Grounded Doubt-Chat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** From a graded test's wrong question, let the student open doubt-chat pre-loaded with *their actual mistake* (their answer + the reference + the grader's feedback), so the tutor remediates the specific misconception instead of the generic topic.

**Architecture:** Mirror the existing optional `contextChunksBlock` grounding path end-to-end: add an optional `mistakeBlock` to the doubt scope payload, a `{{mistake_block}}` placeholder in the inline `SCOPE_TEMPLATE`, a server-side loader that reconstructs the mistake from `student_answers`+`questions` by `questionId` (never trusting client-supplied answer text), and an "Ask about this" entry point on the graded-question view. No new tables; no migration.

**Tech Stack:** Next.js 15 server actions + route handlers, TypeScript (TABS, `@/`=`src/`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md` §9 (Surface A). Depends on Phases 1–2 only conceptually (independent code path).

---

## Key reused seams (verified, file:line)

| Concern | Reuse | Location |
|---|---|---|
| Optional grounding-block pattern to mirror | `contextChunksBlock` on `DoubtTopicPayload`/`DoubtChapterPayload` | `src/lib/doubt/validate-doubt-scope.ts:24,38` |
| Attach a block to scope | `attachTopicContextChunksToScope(scope, block)` | `app/api/student/doubt-chat/route.ts:206-221` |
| Prompt template + interpolation | `SCOPE_TEMPLATE` (inline TS), `interpolateDoubtPromptTemplate()` | `src/lib/ai/doubt-prompt-templates.ts:65-81,138-184` |
| Conversation create (server action) | `createDoubtConversation` + `createSchema` | `src/lib/doubt/doubt-actions.ts:23-106` |
| Hidden bootstrap message | `buildDoubtHiddenBootstrapUserContent(scope)` | `src/lib/doubt/doubt-actions.ts:85-90` |
| Graded-answer data (mistake source) | `RawDetailRow` (student_answer, is_correct, ai_feedback, ai_user_answer_summary, ai_reference_answer_summary, question_text, answer_key, topic_id, subject_id) | `src/lib/student/qna-logs/get-qna-log-detail.ts:15-32` |
| Tutor modes (unchanged) | `DoubtTutorMode` | `src/lib/doubt/doubt-tutor-mode.ts` |
| Fingerprint guard (only if a .md prompt changes) | `pnpm exec tsx scripts/check-doubt-prompt-fingerprint.ts --write` | `scripts/check-doubt-prompt-fingerprint.ts` |

> **Fingerprint note:** This plan edits only the inline TS `SCOPE_TEMPLATE` and TS code — it does **not** touch any fingerprinted `docs/*.md` prompt body. So no fingerprint rewrite is required. (If during execution you decide to put guidance in `doubt-shared-preamble.md` instead, run the `--write` step and commit `docs/doubt-prompt-fingerprint.json`.)

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/lib/doubt/mistake-context.ts` | Create | Load + format a student's mistake for a `questionId` (ownership-checked). Pure formatter + a DB loader. |
| `src/lib/doubt/__tests__/mistake-context.test.ts` | Create | Unit-test the pure formatter. |
| `src/lib/doubt/validate-doubt-scope.ts` | Modify (~L24,38) | Add optional `mistakeBlock?: string` to topic + chapter payloads. |
| `src/lib/ai/doubt-prompt-templates.ts` | Modify (~L65-81, L138-184) | Add `{{mistake_block}}` to `SCOPE_TEMPLATE`; set the var in `interpolateDoubtPromptTemplate`. |
| `src/lib/doubt/doubt-actions.ts` | Modify (~L23-106) | Accept optional `mistakeContext: { questionId }`; load + attach `mistakeBlock`. |
| `app/api/student/doubt-chat/route.ts` | Modify (~L206-227) | On resume, re-attach the stored mistake block to scope (mirror context-chunks attach). |
| Graded-question view (confirm at exec: `src/lib/student/qna-logs/*` detail component or the report view under `/student/reports`) | Modify | Add "Ask about this" action per wrong question → `createDoubtConversation({..., mistakeContext})` → redirect to `/student/doubt-chat?c=<id>`. |

**Verify:** `node_modules/.bin/tsc --noEmit -p tsconfig.json`; `node_modules/.bin/vitest run`; changed files `| xargs node_modules/.bin/eslint --max-warnings=0`.

---

## Task 1: Mistake-context loader + formatter

**Files:** Create `src/lib/doubt/mistake-context.ts` + `src/lib/doubt/__tests__/mistake-context.test.ts`.

- [ ] **Step 1: Write the failing test** for the pure formatter:

```ts
import { describe, expect, it } from "vitest";
import { formatMistakeBlock } from "@/lib/doubt/mistake-context";

describe("formatMistakeBlock", () => {
	it("renders the student answer, reference, and feedback", () => {
		const block = formatMistakeBlock({
			questionText: "What is 1/2 + 1/4?",
			studentAnswerSummary: "Said 2/6",
			referenceAnswerSummary: "3/4",
			feedback: "Find a common denominator first.",
		});
		expect(block).toContain("What is 1/2 + 1/4?");
		expect(block).toContain("Said 2/6");
		expect(block).toContain("3/4");
		expect(block).toContain("common denominator");
	});

	it("omits missing parts gracefully and returns null when nothing useful", () => {
		expect(formatMistakeBlock({ questionText: "Q", studentAnswerSummary: null, referenceAnswerSummary: null, feedback: null }))
			.toContain("Q");
		expect(formatMistakeBlock({ questionText: null, studentAnswerSummary: null, referenceAnswerSummary: null, feedback: null }))
			.toBeNull();
	});
});
```

- [ ] **Step 2:** Run → fail (module missing).
- [ ] **Step 3: Implement** `mistake-context.ts`:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type MistakeParts = {
	questionText: string | null;
	studentAnswerSummary: string | null;
	referenceAnswerSummary: string | null;
	feedback: string | null;
};

/** Pure: render the mistake block injected into the doubt prompt. Null if empty. */
export function formatMistakeBlock(parts: MistakeParts): string | null {
	const lines: string[] = [];
	if (parts.questionText) lines.push(`Question the student got wrong:\n${parts.questionText}`);
	if (parts.studentAnswerSummary) lines.push(`What the student answered:\n${parts.studentAnswerSummary}`);
	if (parts.referenceAnswerSummary) lines.push(`Correct/reference answer:\n${parts.referenceAnswerSummary}`);
	if (parts.feedback) lines.push(`Grader feedback:\n${parts.feedback}`);
	if (lines.length === 0 || (lines.length === 1 && !parts.questionText)) {
		return parts.questionText ? lines.join("\n\n") : null;
	}
	return lines.join("\n\n");
}

/**
 * Load a student's mistake for a question, ownership-checked: the question must
 * belong to a test owned by `studentId` and the answer must be incorrect.
 * Returns null if not found / not owned / answered correctly. Also returns the
 * topicId/subjectId so the caller can scope the conversation.
 */
export async function loadMistakeForQuestion(
	supabase: SupabaseClient,
	studentId: string,
	questionId: string,
): Promise<{ block: string; topicId: string; subjectId: string } | null> {
	const { data } = await supabase
		.from("student_answers")
		.select(
			"is_correct, student_answer, ai_feedback, ai_user_answer_summary, ai_reference_answer_summary, " +
				"questions!inner(question_text, topic_id, test_id, tests!inner(student_id, subject_id))",
		)
		.eq("question_id", questionId)
		.maybeSingle();

	const row = data as unknown as {
		is_correct: boolean | null;
		ai_feedback: string | null;
		ai_user_answer_summary: string | null;
		ai_reference_answer_summary: string | null;
		questions: {
			question_text: string | null;
			topic_id: string;
			tests: { student_id: string; subject_id: string };
		} | null;
	} | null;

	if (!row || !row.questions) return null;
	if (row.questions.tests.student_id !== studentId) return null; // ownership
	if (row.is_correct === true) return null; // only ground on mistakes

	const block = formatMistakeBlock({
		questionText: row.questions.question_text,
		studentAnswerSummary: row.ai_user_answer_summary,
		referenceAnswerSummary: row.ai_reference_answer_summary,
		feedback: row.ai_feedback,
	});
	if (!block) return null;
	return { block, topicId: row.questions.topic_id, subjectId: row.questions.tests.subject_id };
}
```

> At execution, confirm the PostgREST embedded-join syntax against this codebase's Supabase version; if the nested embed is awkward, fall back to two explicit selects (answer row, then question+test). The ownership check is the security-critical part — keep it.

- [ ] **Step 4:** Run → pass. **Step 5:** tsc + eslint. **Step 6:** Commit.

---

## Task 2: Optional `mistakeBlock` on scope + template

**Files:** `src/lib/doubt/validate-doubt-scope.ts`, `src/lib/ai/doubt-prompt-templates.ts`.

- [ ] **Step 1:** In `validate-doubt-scope.ts`, add `mistakeBlock?: string;` to both `DoubtTopicPayload` (~L24, next to `contextChunksBlock`) and `DoubtChapterPayload` (~L38).
- [ ] **Step 2:** In `doubt-prompt-templates.ts` `SCOPE_TEMPLATE` (~L65-81), append a block after the learning-objectives section:

```
## Student's specific mistake (remediate THIS)
{{mistake_block}}
```

- [ ] **Step 3:** In `interpolateDoubtPromptTemplate()` (~L138-184), set the var in both the topic vars object (~L141) and chapter vars object (~L162):

```ts
mistake_block: scope.topic?.mistakeBlock ?? scope.chapter?.mistakeBlock ?? "(none — answer the student's question on this topic)",
```

(Match the exact `scope` access shape used for `contextChunksBlock` in this function.)

- [ ] **Step 4:** tsc + eslint. **Step 5:** Commit. (No fingerprint change — `SCOPE_TEMPLATE` is inline TS.)

---

## Task 3: Thread `mistakeContext` through conversation create + resume

**Files:** `src/lib/doubt/doubt-actions.ts`, `app/api/student/doubt-chat/route.ts`.

- [ ] **Step 1:** Extend `createSchema` (~L23-40) with an optional field:

```ts
mistakeContext: z.object({ questionId: z.string().uuid() }).optional(),
```

- [ ] **Step 2:** In `createDoubtConversation` (~L45-106), after the scope is validated and before insert: if `input.mistakeContext` is present, call `loadMistakeForQuestion(supabase, userId, input.mistakeContext.questionId)`; if it returns a block, set `scope.topic.mistakeBlock`/`scope.chapter.mistakeBlock` (mirror `attachTopicContextChunksToScope`) and prefer its `topicId`/`subjectId` for scoping consistency. Persist the block onto the conversation row's `metadata` (so resume can re-inject it) — reuse the existing `metadata` jsonb column used for chapter scope.
- [ ] **Step 3:** In `app/api/student/doubt-chat/route.ts` (~L206-227), where `attachTopicContextChunksToScope` runs on resume, also re-attach `conversation.metadata.mistakeBlock` to the scope if present, so every turn keeps the grounding.
- [ ] **Step 4:** tsc + eslint. **Step 5:** Commit.

---

## Task 4: "Ask about this" entry point on graded questions

**Files:** the graded-question view (confirm exact component at execution — the QnA-log detail under `src/lib/student/qna-logs/` / `app/student/qna-logs/`, and/or the report view reached at `/student/reports?test=<id>`).

- [ ] **Step 1:** Locate where a graded test's per-question results render (wrong answers shown with feedback). Confirm `questionId`, `subjectId`, `topicId`, and `is_correct` are available per row (they are, per `get-qna-log-detail.ts`).
- [ ] **Step 2:** For rows with `is_correct === false`, add an "Ask about this" button (reuse the existing `Button` with `render={<Link/>}` slot pattern, or a small client action). On click, call `createDoubtConversation({ subjectId, topicId, mistakeContext: { questionId } })` and redirect to `/student/doubt-chat?c=<conversationId>`.
- [ ] **Step 3:** Add a test for the wiring helper (the function that builds the create-conversation input from a question row). tsc + eslint. **Step 4:** Commit.

> If the graded view is a server component that can't trivially host a client action, add a tiny client wrapper component (`AskAboutThisButton`) — keep it minimal and reuse existing toast/Link patterns.

---

## Task 5: Verification

- [ ] `node_modules/.bin/vitest run` — full suite green incl. the new formatter test.
- [ ] `node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- [ ] eslint on all changed files (`--max-warnings=0`).
- [ ] **Manual:** grade a test with a wrong answer → open its report → "Ask about this" → confirm the doubt chat's first tutor turn references the *specific* misconception (the student's answer + reference), not just the topic. Confirm a *correct* question shows no button (and `loadMistakeForQuestion` returns null if called).
- [ ] Confirm no `docs/*.md` prompt changed → `pnpm exec tsx scripts/check-doubt-prompt-fingerprint.ts` still passes without `--write`.

---

## Phase 3 self-review (vs spec §9 Surface A)

- Mistake context = student answer + reference + grader feedback, server-loaded by `questionId` with ownership check (no client-trusted answer text). ✓
- Injected via the proven optional-block path (`mistakeBlock` ↔ `contextChunksBlock`); modes (explain/solve-with-me/quiz-me) unchanged and mode-agnostic since the block lives in the shared scope template. ✓
- Entry point on graded wrong questions. ✓
- No migration; no fingerprint trip (inline TS template only). ✓
- **Open at exec:** exact graded-question component to host the button; PostgREST nested-embed syntax in `loadMistakeForQuestion` (fall back to two selects if needed); confirm the `metadata` jsonb column on `doubt_conversations` is free to carry `mistakeBlock`.
