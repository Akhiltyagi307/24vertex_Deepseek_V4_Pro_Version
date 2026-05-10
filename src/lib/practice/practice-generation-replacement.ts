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
	| "visual_leaks_answer"
	| "chunk_alignment_weak"
	| "smiles_invalid"
	| "expr_undefined"
	| "spec_invalid"
	| "renderer_unsupported";

export type VisualFixReplacementArgs = {
	baseUserPrompt: string;
	failedQuestionIndexes: number[];
	failureCode: VisualFixFailureCode;
	failureDetails: string;
	/** When set, reminds the model which `visual.spec.kind` values are allowed for this subject. */
	preferredVisualKinds?: readonly string[];
	/** Full grouped JSON from the failed pass — same pattern as repair. */
	currentGroupedJson: string;
};

const VISUAL_FIX_CODE_HINTS: Record<VisualFixFailureCode, string> = {
	stem_references_missing_visual:
		"Either emit a visual matching the stem’s figure/table/below cues or rewrite the stem so it does not imply a missing diagram.",
	visual_label_mismatch:
		"Align primitive/axis labels in visual.spec with every letter and numeric label referenced in the stem.",
	visual_leaks_answer:
		"Caption/altText must describe layout only — remove any text that repeats the keyed answer or correct option.",
	chunk_alignment_weak:
		"Reuse vocabulary and scenario shapes from that topic’s topic_grounding chunks; paraphrase but stay traceable.",
	smiles_invalid:
		"Use a parseable skeletal SMILES string; check valence and bond closure parentheses.",
	expr_undefined:
		"Shrink the plot domain or fix mathjs/mhchem expressions so they are defined and finite over the window.",
	spec_invalid:
		"Match the Zod/OpenAI schema exactly — required fields, correct discriminated kind/subKind, numeric ranges.",
	renderer_unsupported:
		"If the kind is not in visuals_policy.preferred_kinds, set visual to null and rewrite the stem.",
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
	const preferredLine =
		args.preferredVisualKinds && args.preferredVisualKinds.length > 0 ?
			`- Non-null repairs: use only these \`visual.spec.kind\` values: ${JSON.stringify([...args.preferredVisualKinds])}.`
		:	"";

	return [
		args.baseUserPrompt,
		"",
		args.currentGroupedJson.trim().length > 0 ?
			[
				"CURRENT_GROUPED_GENERATION_JSON (complete last output — return the SAME shape with ONLY FAILED_INDEXES questions repaired):",
				args.currentGroupedJson,
				"",
			].join("\n")
		:	"",
		"VISUAL_FIX_MODE:",
		"- Regenerate ONLY the questions whose 0-based index appears in FAILED_INDEXES (flattened order: MCQ, then fill_in_blank, short_answer, long_answer as in questions_by_type).",
		"- Keep every other question byte-for-byte identical unless a shared field must change for consistency.",
		`- Failure code: ${args.failureCode}.`,
		`- Failure details: ${args.failureDetails}`,
		`- Repair hint: ${VISUAL_FIX_CODE_HINTS[args.failureCode]}`,
		...(preferredLine ? [preferredLine] : []),
		"- Respect ALL hard gates including the Visuals discipline section.",
		"- If the failure is visual_leaks_answer: rewrite caption and altText only so they still describe layout/axes/labels but never repeat the keyed answer, correct option text, or spoiling conclusions; keep spec data unless it must change for consistency.",
		"- If the failure is chunk_alignment_weak: rewrite stems (and visuals if needed) so key content words and scenarios overlap the topic's topic_grounding chunks.",
		"- For each fix you may either (a) repair the visual spec, or (b) set visual to null and rewrite the stem to be self-contained.",
		"- A correct question without a visual is ALWAYS preferred to a wrong or noisy visual.",
		"FAILED_INDEXES:",
		JSON.stringify(args.failedQuestionIndexes),
	].join("\n");
}
