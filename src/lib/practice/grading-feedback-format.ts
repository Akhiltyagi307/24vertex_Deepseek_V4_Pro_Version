import type { GradedQuestionItem } from "@/lib/practice/grading-schema";

/** Embedded in `student_answers.ai_feedback` before coach text (v1). */
export const GRADING_META_MARKER = "[[24v_grading_meta:v1]]";

export type GradingFeedbackMetaV1 = {
	band_label: string;
	what_was_correct: string[];
	where_marks_were_lost: string[];
	to_reach_next_band: string;
	criterion_scores?: GradedQuestionItem["criterion_scores"];
};

export type ParsedStoredGradingFeedback = {
	meta: GradingFeedbackMetaV1 | null;
	analysis: string;
	stepByStep: string | null;
};

function stripMetaFromAiFeedback(aiFeedback: string): ParsedStoredGradingFeedback {
	const raw = aiFeedback.trim();
	if (!raw.startsWith(GRADING_META_MARKER)) {
		const [analysisPart, stepPart] = raw.split("\n\nStep-by-step:\n");
		const analysis = (analysisPart ?? raw).trim();
		const stepByStep = stepPart?.trim() ? stepPart.trim() : null;
		return { meta: null, analysis, stepByStep };
	}

	const afterMarker = raw.slice(GRADING_META_MARKER.length);
	const jsonEnd = afterMarker.indexOf("\n");
	if (jsonEnd < 0) {
		return parseLegacyTail(raw);
	}

	const jsonSlice = afterMarker.slice(0, jsonEnd).trim();
	const tail = afterMarker.slice(jsonEnd + 1).trimStart();

	let meta: GradingFeedbackMetaV1 | null = null;
	try {
		const parsed = JSON.parse(jsonSlice) as GradingFeedbackMetaV1;
		if (parsed && typeof parsed.band_label === "string") {
			meta = {
				band_label: parsed.band_label,
				what_was_correct: Array.isArray(parsed.what_was_correct) ? parsed.what_was_correct.map(String) : [],
				where_marks_were_lost: Array.isArray(parsed.where_marks_were_lost) ?
					parsed.where_marks_were_lost.map(String)
				:	[],
				to_reach_next_band: typeof parsed.to_reach_next_band === "string" ? parsed.to_reach_next_band : "",
				criterion_scores: parsed.criterion_scores,
			};
		}
	} catch {
		meta = null;
	}

	const [analysisPart, stepPart] = tail.split("\n\nStep-by-step:\n");
	const analysis = (analysisPart ?? tail).trim();
	const stepByStep = stepPart?.trim() ? stepPart.trim() : null;
	return { meta, analysis, stepByStep };
}

function parseLegacyTail(raw: string): ParsedStoredGradingFeedback {
	const [analysisPart, stepPart] = raw.split("\n\nStep-by-step:\n");
	return {
		meta: null,
		analysis: (analysisPart ?? raw).trim(),
		stepByStep: stepPart?.trim() ? stepPart.trim() : null,
	};
}

/** Parse `ai_feedback` column (legacy plain text or v1 meta prefix). */
export function parseStoredGradingFeedback(aiFeedback: string | null | undefined): ParsedStoredGradingFeedback {
	if (!aiFeedback?.trim()) {
		return { meta: null, analysis: "", stepByStep: null };
	}
	return stripMetaFromAiFeedback(aiFeedback);
}

/** Serialize graded item for DB `ai_feedback` (backward-compatible tail). */
export function formatGradingFeedbackForStorage(g: GradedQuestionItem): string {
	const meta: GradingFeedbackMetaV1 = {
		band_label: g.band_label.trim(),
		what_was_correct: g.what_was_correct.map((s) => s.trim()).filter(Boolean),
		where_marks_were_lost: g.where_marks_were_lost.map((s) => s.trim()).filter(Boolean),
		to_reach_next_band: g.to_reach_next_band.trim(),
		criterion_scores: g.criterion_scores?.length ? g.criterion_scores : undefined,
	};

	const parts: string[] = [`${GRADING_META_MARKER}${JSON.stringify(meta)}`];

	const analysis = g.analysis.trim();
	if (analysis) parts.push(analysis);

	const steps = g.step_by_step_solution?.trim();
	if (steps) parts.push(`Step-by-step:\n${steps}`);

	return parts.join("\n\n");
}

/** Merge parsed storage + DB summaries into a full graded item for PDF/UI. */
export function gradedItemFromStoredFeedback(args: {
	question_id: string;
	topic_id: string;
	score: number;
	verdict: GradedQuestionItem["verdict"];
	user_answer_summary: string;
	reference_answer_summary: string;
	ai_feedback: string | null | undefined;
}): Pick<
	GradedQuestionItem,
	| "question_id"
	| "topic_id"
	| "score"
	| "verdict"
	| "user_answer_summary"
	| "reference_answer_summary"
	| "analysis"
	| "step_by_step_solution"
	| "band_label"
	| "what_was_correct"
	| "where_marks_were_lost"
	| "to_reach_next_band"
	| "criterion_scores"
> {
	const parsed = parseStoredGradingFeedback(args.ai_feedback);
	const meta = parsed.meta;

	return {
		question_id: args.question_id,
		topic_id: args.topic_id,
		score: args.score,
		verdict: args.verdict,
		user_answer_summary: args.user_answer_summary,
		reference_answer_summary: args.reference_answer_summary,
		analysis: parsed.analysis,
		step_by_step_solution: parsed.stepByStep ?? undefined,
		band_label: meta?.band_label ?? defaultBandLabel(args.score, args.verdict),
		what_was_correct: meta?.what_was_correct ?? [],
		where_marks_were_lost: meta?.where_marks_were_lost ?? [],
		to_reach_next_band: meta?.to_reach_next_band ?? "",
		criterion_scores: meta?.criterion_scores,
	};
}

function defaultBandLabel(score: number, verdict: GradedQuestionItem["verdict"]): string {
	if (verdict === "correct" || score >= 85) return "Full credit";
	if (verdict === "incorrect" || score <= 24) return "Needs work";
	return "Partial credit";
}
