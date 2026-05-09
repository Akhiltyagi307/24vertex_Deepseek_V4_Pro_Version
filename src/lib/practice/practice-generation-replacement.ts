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
