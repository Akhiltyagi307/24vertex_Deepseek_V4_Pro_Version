import "server-only";

import { z } from "zod";

import { recordAiCall } from "@/lib/ai/record-ai-call";
import { resolveChatModel } from "@/lib/ai/model-router";
import { generateStructured } from "@/lib/ai/structured-output";
import { logServerError } from "@/lib/server/log-supabase-error";

import type { PracticeQuestionTypeCounts } from "./constants";
import type { PracticeGenerationOutput } from "./generation-schema";

/**
 * Final structural + sanity validator for the 3-call pipeline variant.
 *
 * Wraps a small Flash (no-thinking) call that re-reads the fully-assembled
 * test and returns either "ok" or a list of per-index issues. The pipeline
 * feeds the failed indexes into the existing repair loop — same code path
 * the regular validation gates use — so a Flash validator failure is just
 * another reason for a targeted repair.
 *
 * Why this exists when we already validate with Zod + quality gates:
 *   - Zod catches schema shape (right types, right lengths). It can't catch
 *     "stem says 'in the graph below' but visual is null".
 *   - Quality gates catch deterministic things (chunk alignment, topic
 *     concentration). They can't catch "all four MCQ options paraphrase
 *     each other" without a semantic model.
 *   - The LLM blueprint pre-call used to act as a soft sanity check on the
 *     final assembly; without it we lean on this validator instead.
 *
 * Cost target: ~₹0.20 / call, latency ~8–15s. Anything heavier and we lose
 * the latency budget the 3-call variant was designed to recover.
 */

const validationIssueSchema = z.object({
	index: z.number().int().min(0),
	code: z.enum([
		"missing_visual_reference",
		"mcq_option_homogeneity",
		"truncated_stem",
		"answer_key_inconsistent",
		"topic_id_not_in_whitelist",
		"type_count_mismatch",
		"other",
	]),
	reason: z.string().max(280),
});

export const practiceValidationOutputSchema = z.object({
	ok: z.boolean(),
	issues: z.array(validationIssueSchema).max(60),
	summary: z.string().max(400).nullable(),
});

export type PracticeValidationOutput = z.infer<typeof practiceValidationOutputSchema>;

export type PracticeValidationResult =
	| {
			ok: true;
			latencyMs: number;
			inputTokens: number;
			outputTokens: number;
	  }
	| {
			ok: false;
			failedIndexes: number[];
			issues: PracticeValidationOutput["issues"];
			latencyMs: number;
			inputTokens: number;
			outputTokens: number;
			message: string;
	  };

function buildValidationSystemPrompt(): string {
	return [
		"You are the final structure and sanity checker for an AI-generated school practice test.",
		"You will receive (a) the assembled test as JSON and (b) the contract it must satisfy.",
		"",
		"Return ok=true if every question is internally consistent. Return ok=false when ANY of the codes below apply, and list one issue per affected question:",
		"",
		"- missing_visual_reference: stem references a figure / graph / table / diagram (e.g. \"in the graph below\", \"based on the table\", \"as shown\") but the question's visual is null.",
		"- mcq_option_homogeneity: all four MCQ options are paraphrases of the same answer (e.g. four different ways of saying \"increases\"). One distractor matching the key in spirit is fine; four matches is not.",
		"- truncated_stem: stem ends mid-sentence, has obvious copy-paste cruft, or is missing the actual question.",
		"- answer_key_inconsistent: MCQ key isn't one of A/B/C/D, fill_in_blank key isn't a string, numerical answer is missing units when the question demands them, long_answer key is empty.",
		"- topic_id_not_in_whitelist: a question's topic_id is not in the provided ALLOWED_TOPIC_IDS list.",
		"- type_count_mismatch: total counts per question type don't equal EXPECTED_TYPE_COUNTS.",
		"- other: any clear quality failure not covered above. Use sparingly.",
		"",
		"Index is the zero-based flat position in the questions array (matches the JSON order).",
		"",
		"Be a strict but fair editor. Do NOT flag questions that are merely \"could be improved\" — only fail when something would confuse a real student.",
	].join("\n");
}

function buildValidationUserPrompt(args: {
	questions: PracticeGenerationOutput["questions"];
	expectedTypeCounts: PracticeQuestionTypeCounts;
	allowedTopicIds: readonly string[];
}): string {
	// Compact projection of each question — drop fields the validator can't
	// meaningfully use (estimated_time_seconds, etc.) to keep input cost low.
	const compact = args.questions.map((q, i) => ({
		index: i,
		question_type: q.question_type,
		topic_id: q.topic_id,
		stem: q.question_text,
		options:
			q.question_type === "multiple_choice"
				? (q as { options?: Record<string, string> }).options ?? null
				: null,
		answer_key: q.answer_key,
		visual_present: q.visual != null,
	}));

	return [
		"EXPECTED_TYPE_COUNTS:",
		JSON.stringify(args.expectedTypeCounts),
		"",
		"ALLOWED_TOPIC_IDS:",
		JSON.stringify(args.allowedTopicIds),
		"",
		"QUESTIONS_JSON:",
		JSON.stringify(compact),
	].join("\n");
}

export type RunPracticeValidationArgs = {
	output: PracticeGenerationOutput;
	expectedTypeCounts: PracticeQuestionTypeCounts;
	allowedTopicIds: readonly string[];
	studentUserId: string;
	telemetry: {
		generationRunId: string | null;
		correlationId: string;
		testId?: string | null;
		stepKey: string;
	};
	abortSignal?: AbortSignal;
};

/**
 * Call the Flash validator. Returns `{ ok: true }` when the assembled test
 * passes; returns `{ ok: false, failedIndexes }` otherwise — caller feeds the
 * failed indexes into the existing repair loop.
 *
 * Never throws — any error surfaces as `ok: true` with a Sentry breadcrumb so
 * the validator can't itself block a successful generation. (If the validator
 * pipeline is broken, we'd rather ship the test than block on a flaky safety
 * check; the deterministic Zod + quality gates already ran.)
 */
export async function runPracticeValidationPass(
	args: RunPracticeValidationArgs,
): Promise<PracticeValidationResult> {
	const resolved = resolveChatModel("practice.generation.validation");
	const t0 = Date.now();
	try {
		const result = await generateStructured({
			resolved,
			schema: practiceValidationOutputSchema,
			system: buildValidationSystemPrompt(),
			prompt: buildValidationUserPrompt({
				questions: args.output.questions,
				expectedTypeCounts: args.expectedTypeCounts,
				allowedTopicIds: args.allowedTopicIds,
			}),
			// Output is small (just a list of issues) — keep budget tight so a
			// hung call fails fast.
			maxOutputTokens: 4_000,
			maxRetries: 1,
			abortSignal: args.abortSignal,
			maxRepairAttempts: 1,
		});

		const latencyMs = Date.now() - t0;
		const inputTokens = result.usage.inputTokens ?? 0;
		const outputTokens = result.usage.outputTokens ?? 0;

		void recordAiCall({
			feature: "practice.generation.validation",
			model: resolved.modelId,
			userId: args.studentUserId,
			generationRunId: args.telemetry.generationRunId,
			correlationId: args.telemetry.correlationId,
			testId: args.telemetry.testId ?? null,
			stepKey: args.telemetry.stepKey,
			inputTokens,
			outputTokens,
			latencyMs,
			status: "ok",
		});

		if (result.object.ok) {
			return { ok: true, latencyMs, inputTokens, outputTokens };
		}

		const issues = result.object.issues;
		const failedIndexes = [
			...new Set(
				issues
					.map((i) => i.index)
					.filter((i) => Number.isInteger(i) && i >= 0 && i < args.output.questions.length),
			),
		];
		const message =
			result.object.summary?.trim() ||
			`Validator flagged ${issues.length} issue${issues.length === 1 ? "" : "s"}.`;
		return {
			ok: false,
			failedIndexes,
			issues,
			latencyMs,
			inputTokens,
			outputTokens,
			message,
		};
	} catch (e) {
		const latencyMs = Date.now() - t0;
		logServerError("runPracticeValidationPass", e, {
			correlationId: args.telemetry.correlationId,
		});
		void recordAiCall({
			feature: "practice.generation.validation",
			model: resolved.modelId,
			userId: args.studentUserId,
			generationRunId: args.telemetry.generationRunId,
			correlationId: args.telemetry.correlationId,
			testId: args.telemetry.testId ?? null,
			stepKey: args.telemetry.stepKey,
			inputTokens: 0,
			outputTokens: 0,
			latencyMs,
			status: "error",
			error: e instanceof Error ? e.message : String(e),
		});
		// Fail-open: a broken validator must not block a passing test.
		return { ok: true, latencyMs, inputTokens: 0, outputTokens: 0 };
	}
}
