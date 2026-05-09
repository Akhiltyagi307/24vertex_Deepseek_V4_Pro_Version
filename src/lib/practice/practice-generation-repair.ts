import type { PracticeQuestionTypeCounts } from "./constants";

const REPAIR_USER_BODY_MAX_CHARS = 380_000;

/**
 * System prompt for a single corrective pass after the main generator output
 * fails {@link validateAndStripGeneration}. Keeps the same Zod schema as
 * initial generation so structured output stays aligned.
 */
export function buildPracticeGenerationRepairSystemPrompt(): string {
	return `You repair a practice test JSON object that failed automated validation.

Hard rules:
- Return the SAME top-level shape: questions_by_type (four arrays) + generation_metadata.
- Preserve the SAME array length in each bucket as in the input (do not add or remove questions).
- multiple_choice: every item MUST include options with exactly keys A, B, C, D (strings). Never use options: null there. If a stem reads like a fill-in, rewrite it as a proper MCQ with four plausible choices while keeping the same bucket.
- fill_in_blank, short_answer, long_answer: every item MUST include "options": null. Never put MCQ options in those buckets.
- topic_id on every question MUST be an exact string copy from ALLOWED_TOPIC_IDS — no invented UUIDs, no splicing segments from two different ids.
- estimated_time_seconds: positive integers; the SUM across all questions must be between TIME_SUM_MIN and TIME_SUM_MAX inclusive (given in the user message).
- answer_key.correct_answer for MCQ must be exactly one letter A, B, C, or D matching the options.

Preserve pedagogy and wording where you can; change only what is needed to satisfy the failure. Output JSON only — no markdown fences or commentary.`;
}

export function buildPracticeGenerationRepairUserPrompt(args: {
	validationMessage: string;
	timeLimitSeconds: number;
	timeSumMin: number;
	timeSumMax: number;
	allowedTopicIds: string[];
	questionTypeCounts: PracticeQuestionTypeCounts;
	failedGroupedJson: string;
}): string {
	let body = args.failedGroupedJson;
	if (body.length > REPAIR_USER_BODY_MAX_CHARS) {
		body =
			body.slice(0, REPAIR_USER_BODY_MAX_CHARS) +
			"\n...(truncated for size; use VALIDATION_FAILURE and ALLOWED_TOPIC_IDS to complete the repair.)";
	}
	return [
		`VALIDATION_FAILURE: ${args.validationMessage}`,
		`TIME_LIMIT_SECONDS: ${args.timeLimitSeconds}`,
		`TIME_SUM_MIN: ${args.timeSumMin}`,
		`TIME_SUM_MAX: ${args.timeSumMax}`,
		`ALLOWED_TOPIC_IDS:`,
		JSON.stringify(args.allowedTopicIds),
		`REQUIRED_BUCKET_LENGTHS (questions_by_type.*.length):`,
		JSON.stringify(args.questionTypeCounts),
		`FAILED_OUTPUT_JSON:`,
		body,
	].join("\n");
}
