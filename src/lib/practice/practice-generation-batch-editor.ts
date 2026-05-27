import { z } from "zod";

import { resolveChatModel } from "@/lib/ai/model-router";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { generateStructured } from "@/lib/ai/structured-output";

import type { PracticeBatchAuditIssue, PracticeBatchAuditResult } from "./practice-generation-batch-audit";
import type { PracticeGenerationOutput } from "./generation-schema";

/**
 * Tier-3 Flash editor pass. Runs ONCE after the parallel batches merge.
 * Reads the full test plus the post-merge audit issues and returns a small
 * patch list that the pipeline applies surgically — no full regeneration,
 * no schema-rebuild.
 *
 * Routed via `practice.generation.validation` (Flash by default, thinking
 * disabled) so it's cheap and fast (~2-4s, ~$0.005).
 */

const editorPatchSchema = z.object({
	/** Index into the merged test's flattened `questions` array. */
	question_index: z.number().int().min(0),
	/** What to change. Multiple fields may be patched per question. */
	patch: z.object({
		question_text: z.string().optional(),
		correct_answer: z.string().optional(),
		options: z
			.object({
				A: z.string(),
				B: z.string(),
				C: z.string(),
				D: z.string(),
			})
			.optional(),
		difficulty_level: z.enum(["easy", "medium", "hard"]).optional(),
		estimated_time_seconds: z.number().int().positive().optional(),
	}),
	reason: z.string().min(1).max(160),
});

const editorOutputSchema = z.object({
	/** Up to 8 patches per call to keep the editor surgical. */
	patches: z.array(editorPatchSchema).max(8),
	/** Empty when no improvements were applied. */
	summary: z.string().max(400),
});

export type PracticeGenerationBatchEditorPatch = z.infer<typeof editorPatchSchema>;
export type PracticeGenerationBatchEditorOutput = z.infer<typeof editorOutputSchema>;

const SYSTEM_PROMPT = `You are an EDITOR for a school practice test. Four parallel writer models drafted the questions; their merged output is below alongside an AUDIT report of issues that survived merging.

YOUR JOB
Return a small list of SURGICAL patches that resolve the audit issues. Do NOT regenerate the test. Do NOT rewrite questions that aren't flagged. Touch the minimum number of fields per patch.

ALLOWED PATCH TYPES (per question_index)
- "correct_answer": when the audit reports letter_imbalance for MCQs, REASSIGN the correct letter ONLY by re-checking which option is actually correct — if the right answer truly is "B", do not move it. If the test has 7 MCQs with 5 correct=A, look for an MCQ whose options happen to have the right answer at a different letter via legitimate re-ordering and swap option contents (NEVER change which content is keyed).
- "options" (full {A,B,C,D}): when fixing letter imbalance, you may RE-ORDER the four option strings so the correct content lands at a different letter; you MUST also update "correct_answer" to match the new letter, and the content of the correct answer MUST NOT change.
- "question_text": when the audit reports near_duplicate_stem, rewrite the LATER of the two indexes with a DIFFERENT scenario / values / framing — same skill_target, same difficulty, fresh phrasing. Never edit the earlier index in a duplicate pair.
- "difficulty_level": when the audit reports difficulty_ramp_broken, adjust the labels (NOT the content) to enforce easy → medium → hard ordering within each question-type bucket.
- "estimated_time_seconds": when the audit reports time_sum_out_of_band, shave or grow per-item seconds to bring the SUM back into the band.

HARD RULES
- **DO NOT patch MCQ correct_answer or MCQ options.** The validator rejects any MCQ patch that touches correct_answer or options (we cannot safely keep distractor_rationale in sync). If the audit reports letter_imbalance, NOTE it in your summary but DO NOT submit a patch — the imbalance will be handled by a future pipeline pass.
- For non-MCQ items, you may patch correct_answer freely.
- You CAN patch: question_text (rewrite near-duplicate stem on the LATER of two flagged indexes; non-MCQ correct_answer), estimated_time_seconds (bring SUM into band), difficulty_level (relabel for ramp).
- Do NOT introduce factual errors. Do NOT change keyed numerics unless you are also rewriting the stem to make the new numeric correct.
- Each patch's "reason" explains in ≤160 chars which audit issue it addresses (e.g., "near_duplicate_stem: rewrote later stem with fresh scenario").
- If an issue is unfixable surgically (e.g., bloom_clustering needs a re-skilled rewrite, or letter_imbalance which we can't patch from here), SKIP it and note in summary why.
- Cap patches at 8. Pick the highest-impact ones first.`;

function describeIssue(issue: PracticeBatchAuditIssue): string {
	switch (issue.kind) {
		case "letter_imbalance":
			return `letter_imbalance: ${issue.worst_letter} holds ${(issue.worst_share * 100).toFixed(0)}% of correct answers (distribution ${JSON.stringify(issue.distribution)}).`;
		case "bloom_clustering":
			return `bloom_clustering: only ${issue.unique_verbs} distinct verbs; "${issue.dominant_verb}" dominates ${(issue.dominant_share * 100).toFixed(0)}%.`;
		case "time_sum_out_of_band":
			return `time_sum_out_of_band: actual ${issue.actual}s; band [${issue.min}, ${issue.max}].`;
		case "near_duplicate_stem":
			return `near_duplicate_stem: indexes ${issue.indexes.join("↔")} (jaccard ${issue.jaccard}).`;
		case "difficulty_ramp_broken":
			return `difficulty_ramp_broken: ${issue.out_of_order_pairs.length} out-of-order pair(s) — ${JSON.stringify(issue.out_of_order_pairs.slice(0, 4))}.`;
	}
}

export type RunPracticeBatchEditorArgs = {
	output: PracticeGenerationOutput;
	audit: PracticeBatchAuditResult;
	userId: string;
	correlationId: string;
	generationRunId: string | null;
	promptRevision: string;
	abortSignal?: AbortSignal;
};

export type RunPracticeBatchEditorResult =
	| {
			ok: true;
			patches: PracticeGenerationBatchEditorPatch[];
			summary: string;
			model: string;
			modelMs: number;
			inputTokens: number;
			outputTokens: number;
	  }
	| {
			ok: false;
			message: string;
			model: string;
			modelMs: number;
			inputTokens: number;
			outputTokens: number;
	  };

/**
 * If the audit has no issues, return without making an LLM call.
 */
export async function runPracticeBatchEditorPass(
	args: RunPracticeBatchEditorArgs,
): Promise<RunPracticeBatchEditorResult> {
	const resolved = resolveChatModel("practice.generation.validation");
	const modelId = resolved.modelId;
	const t0 = Date.now();

	if (args.audit.ok || args.audit.issues.length === 0) {
		return {
			ok: true,
			patches: [],
			summary: "no audit issues; editor skipped",
			model: modelId,
			modelMs: 0,
			inputTokens: 0,
			outputTokens: 0,
		};
	}

	const issuesText = args.audit.issues.map(describeIssue).join("\n");
	const questionsBrief = args.output.questions.map((q, i) => ({
		i,
		t: q.question_type,
		d: q.difficulty_level,
		cd: q.cognitive_demand ?? null,
		t_s: q.estimated_time_seconds,
		stem: q.question_text.slice(0, 240),
		options: q.options ?? null,
		correct: q.answer_key?.correct_answer ?? null,
	}));

	const userPrompt = [
		"AUDIT_ISSUES:",
		issuesText,
		"",
		"MERGED_TEST_QUESTIONS_BRIEF:",
		JSON.stringify(questionsBrief),
		"",
		"AUDIT_SUMMARY:",
		JSON.stringify(args.audit.summary),
	].join("\n");

	try {
		const { object, usage, telemetry } = await generateStructured({
			resolved,
			schema: editorOutputSchema,
			system: SYSTEM_PROMPT,
			prompt: userPrompt,
			maxOutputTokens: 3_000,
			maxRetries: 1,
			abortSignal: args.abortSignal,
			providerOptions: { openai: { strictJsonSchema: true } },
		});
		const latency = Date.now() - t0;
		void recordAiCall({
			feature: "practice.generation.validation",
			model: modelId,
			userId: args.userId,
			promptId: args.promptRevision,
			generationRunId: args.generationRunId,
			correlationId: args.correlationId,
			stepKey: "batch_editor",
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			reasoningTokens: telemetry.reasoningTokens,
			cacheHitTokens: telemetry.cacheHitTokens,
			cacheMissTokens: telemetry.cacheMissTokens,
			provider: telemetry.provider,
			latencyMs: latency,
			status: "ok",
		});
		return {
			ok: true,
			patches: object.patches,
			summary: object.summary,
			model: modelId,
			modelMs: latency,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
		};
	} catch (error) {
		const latency = Date.now() - t0;
		const message = error instanceof Error ? error.message : String(error);
		void recordAiCall({
			feature: "practice.generation.validation",
			model: modelId,
			userId: args.userId,
			promptId: args.promptRevision,
			generationRunId: args.generationRunId,
			correlationId: args.correlationId,
			stepKey: "batch_editor",
			inputTokens: 0,
			outputTokens: 0,
			provider: resolved.provider,
			latencyMs: latency,
			status: "error",
			error: message.slice(0, 320),
		});
		return {
			ok: false,
			message: message.slice(0, 320),
			model: modelId,
			modelMs: latency,
			inputTokens: 0,
			outputTokens: 0,
		};
	}
}

/**
 * Apply the editor's patches to the merged output in place. Returns the
 * count of patches successfully applied vs rejected (e.g., out-of-range
 * index or correct_answer not in {A,B,C,D}).
 */
export function applyPracticeBatchEditorPatches(args: {
	output: PracticeGenerationOutput;
	patches: PracticeGenerationBatchEditorPatch[];
}): { applied: number; rejected: number } {
	let applied = 0;
	let rejected = 0;
	for (const p of args.patches) {
		const q = args.output.questions[p.question_index];
		if (!q) {
			rejected++;
			continue;
		}

		// SAFETY: the editor cannot touch MCQ correct_answer or options without
		// also re-keying distractor_rationale (per-letter feedback the grader
		// quotes). Our patch schema doesn't carry distractor_rationale, so any
		// MCQ patch that touches the options/correct_answer trio is unsafe and
		// is REJECTED here. The audit can still flag letter_imbalance; we just
		// won't auto-fix it from this pass — better to leave the imbalance than
		// to ship a mis-keyed item or mis-labelled rationale.
		//
		// Non-MCQ patches (stem rewrite, time tweak, difficulty relabel) remain
		// in scope.
		const isMcq = q.question_type === "multiple_choice";
		if (isMcq && (p.patch.correct_answer != null || p.patch.options != null)) {
			rejected++;
			continue;
		}

		if (p.patch.question_text != null) q.question_text = p.patch.question_text;
		if (p.patch.options != null) {
			q.options = { ...p.patch.options };
		}
		if (p.patch.correct_answer != null) {
			const v = p.patch.correct_answer.trim().toUpperCase();
			if (isMcq) {
				if (v === "A" || v === "B" || v === "C" || v === "D") {
					q.answer_key.correct_answer = v;
				} else {
					rejected++;
					continue;
				}
			} else {
				q.answer_key.correct_answer = p.patch.correct_answer;
			}
		}
		if (p.patch.difficulty_level != null) q.difficulty_level = p.patch.difficulty_level;
		if (p.patch.estimated_time_seconds != null) {
			q.estimated_time_seconds = p.patch.estimated_time_seconds;
		}
		applied++;
	}
	return { applied, rejected };
}
