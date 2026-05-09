import type { PracticeQuestionTypeCounts } from "./constants";

const REPAIR_USER_BODY_MAX_CHARS = 380_000;

/**
 * System prompt for the targeted repair pass after the main generator output
 * fails {@link validateAndStripGeneration}. Same Zod schema as initial
 * generation; the repair model returns the FULL payload (no diff) but is
 * told to change as little as possible.
 *
 * Strict JSON-schema mode for repair is OFF by default
 * (`PRACTICE_STRICT_JSON_SCHEMA_REPAIR`) — the strict path historically
 * caused the model to regenerate aggressively when we wanted a minimal
 * patch. The post-pass validator is the source of truth.
 */
export function buildPracticeGenerationRepairSystemPrompt(): string {
	return `You repair a practice test JSON object that failed automated validation. Apply the SMALLEST POSSIBLE PATCH that satisfies the validator.

Minimal-patch rules (strict):
- Change ONLY the fields needed to satisfy VALIDATION_FAILURE. Preserve every other field — wording, ordering, topic_id, options, answer letters — byte-for-byte where possible.
- Do not rewrite the test. If 1 question is wrong, fix only that question. If only the time sum is off, adjust only \`estimated_time_seconds\`.
- Allowed-fields hints by failure type:
  - "questions sum to … target …" (time band) → adjust \`estimated_time_seconds\` ONLY (positive integers; sum must land in [TIME_SUM_MIN, TIME_SUM_MAX]). Do not edit any other field.
  - "answer key was not a single letter" (MCQ letter mismatch) → fix only \`answer_key.correct_answer\` to be exactly one of "A", "B", "C", "D" matching one of the existing \`options\` keys; keep the explanation and options unchanged unless the explanation directly contradicts the new letter.
  - "missing options A–D" → add the four \`options\` keys to that one MCQ; keep the question text and answer letter (if valid).
  - "topic that was not in your selection" → set the offending question's \`topic_id\` to the closest match from ALLOWED_TOPIC_IDS by chapter/topic name; do not relocate the question to a different bucket.
  - "Question mix is off" → move questions across buckets to match REQUIRED_BUCKET_LENGTHS, preferring the smallest text edits (e.g. an MCQ stem with no good options can become a fill_in_blank by removing \`options\` and shortening the answer).

Hard contract (always):
- Return the SAME top-level shape: \`questions_by_type\` (four arrays) + \`generation_metadata\`.
- Preserve the SAME array length in each bucket as REQUIRED_BUCKET_LENGTHS.
- multiple_choice items MUST include \`options\` with exactly keys A, B, C, D (strings). Never use \`options: null\` there.
- fill_in_blank, short_answer, long_answer items MUST omit \`options\` (or set null).
- Every \`topic_id\` MUST be an exact string copy from ALLOWED_TOPIC_IDS — no invented UUIDs, no splicing segments from two different ids.
- \`estimated_time_seconds\`: positive integers; SUM across all questions in [TIME_SUM_MIN, TIME_SUM_MAX] inclusive.
- \`answer_key.correct_answer\` for MCQ: exactly one letter A, B, C, or D matching the options.
- Output JSON only — no markdown fences, no commentary.`;
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
