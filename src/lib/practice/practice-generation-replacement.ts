import type { PracticeQuestionTypeCounts } from "./constants";

export type ReplacementPromptArgs = {
	baseUserPrompt: string;
	replacementCounts: PracticeQuestionTypeCounts;
	allowedTopicIds: string[];
	preferredTopicIds: string[];
	blockedQuestionTexts: string[];
};

export function buildLegacyModerationReplacementPrompt(args: ReplacementPromptArgs): string {
	return [
		args.baseUserPrompt,
		"",
		"MODERATION_REPLACEMENT_MODE:",
		"- Generate ONLY replacement questions to fill moderation-filtered slots.",
		"- Preserve pedagogy and exam style; do not include policy/safety commentary.",
		"- Use only topic_id values from ALLOWED_TOPIC_IDS.",
		"- Prefer topic_id values from PREFERRED_TOPIC_IDS where feasible.",
		"- Avoid repeating blocked question stems listed in BLOCKED_QUESTION_TEXTS.",
		"REQUIRED_BUCKET_LENGTHS (questions_by_type.*.length):",
		JSON.stringify(args.replacementCounts),
		"ALLOWED_TOPIC_IDS:",
		JSON.stringify(args.allowedTopicIds),
		"PREFERRED_TOPIC_IDS:",
		JSON.stringify(args.preferredTopicIds),
		"BLOCKED_QUESTION_TEXTS:",
		JSON.stringify(args.blockedQuestionTexts.slice(0, 12)),
	].join("\n");
}

export function buildCompactModerationReplacementPrompt(args: ReplacementPromptArgs): string {
	return [
		"Generate replacement practice questions as strict JSON for the same schema.",
		"Do not include any explanation outside JSON.",
		"Constraints:",
		"- Generate ONLY replacements for moderated questions.",
		"- Use only topic_id values in ALLOWED_TOPIC_IDS.",
		"- Prefer topic_id values in PREFERRED_TOPIC_IDS.",
		"- Avoid reusing BLOCKED_QUESTION_TEXTS.",
		"- Maintain the exact bucket lengths specified.",
		"REQUIRED_BUCKET_LENGTHS (questions_by_type.*.length):",
		JSON.stringify(args.replacementCounts),
		"ALLOWED_TOPIC_IDS:",
		JSON.stringify(args.allowedTopicIds),
		"PREFERRED_TOPIC_IDS:",
		JSON.stringify(args.preferredTopicIds),
		"BLOCKED_QUESTION_TEXTS:",
		JSON.stringify(args.blockedQuestionTexts.slice(0, 12)),
	].join("\n");
}

export type VisualFixFailureCode =
	| "stem_references_missing_visual"
	| "visual_label_mismatch"
	| "smiles_invalid"
	| "expr_undefined"
	| "spec_invalid"
	| "renderer_unsupported";

export type VisualFixReplacementArgs = {
	baseUserPrompt: string;
	failedQuestionIndexes: number[];
	failureCode: VisualFixFailureCode;
	failureDetails: string;
};

/**
 * Builder for a targeted regeneration prompt that replaces ONLY the
 * questions whose visuals failed validation. The pipeline appends this to
 * the existing user message and bumps the model with the original schema —
 * the model can either repair the spec or set `visual: null` and rewrite
 * the stem to be self-contained. See v2 visuals guide §2.8.
 *
 * NOTE: this prompt does not bypass any other constraint — the regenerated
 * questions still go through the full HARD-GATES + autofix + quality-gate
 * pipeline. The point of VISUAL_FIX_MODE is to scope the model's attention
 * to a small subset of questions while leaving the rest untouched.
 */
export function buildVisualFixReplacementPrompt(args: VisualFixReplacementArgs): string {
	return [
		args.baseUserPrompt,
		"",
		"VISUAL_FIX_MODE:",
		"- Regenerate ONLY the questions whose 0-based index appears in FAILED_INDEXES.",
		`- Failure code: ${args.failureCode}.`,
		`- Failure details: ${args.failureDetails}`,
		"- Respect ALL hard gates including the Visuals discipline section.",
		"- For each fix you may either (a) repair the visual spec, or (b) set visual to null and rewrite the stem to be self-contained.",
		"- A correct question without a visual is ALWAYS preferred to a wrong or noisy visual.",
		"FAILED_INDEXES:",
		JSON.stringify(args.failedQuestionIndexes),
	].join("\n");
}
