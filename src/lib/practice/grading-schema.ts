import { z } from "zod";

/** Long-answer rubric criteria (5 × 20/10/0 → score). */
export const LONG_ANSWER_CRITERION_NAMES = [
	"Conceptual accuracy",
	"Coverage of all parts asked",
	"Correct terminology / formulae",
	"Logical structure / reasoning",
	"Worked example or supporting detail",
] as const;

export const gradedCriterionScoreSchema = z.object({
	name: z.string(),
	points: z.union([z.literal(0), z.literal(10), z.literal(20)]),
	note: z.string(),
});

export type GradedCriterionScore = z.infer<typeof gradedCriterionScoreSchema>;

/** Single question result from the AI grader (one chunk). */
export const gradedQuestionItemSchema = z.object({
	question_id: z.string().uuid(),
	topic_id: z.string().uuid(),
	user_answer_summary: z.string(),
	reference_answer_summary: z.string(),
	verdict: z.enum(["correct", "partially_correct", "incorrect"]),
	/** Short coach wrap-up (1–3 sentences). Do not repeat bullet lists from breakdown fields. */
	analysis: z.string(),
	step_by_step_solution: z.string().optional(),
	score: z.number().min(0).max(100),
	/**
	 * Student-facing label, e.g. "Partial credit (50% band)". Must be non-empty —
	 * tightening this from `z.string()` to `.min(1)` lets `generateStructured`'s
	 * repair loop catch and re-prompt when the LLM emits `""`, instead of the
	 * downstream `validateGradingBreakdown` quietly logging a warning.
	 */
	band_label: z.string().min(1),
	/**
	 * What the student did well. Always at least one non-empty item — for full
	 * credit, the prompt instructs the model to use "Full credit on this item."
	 * `.min(1)` (both on the array and inner strings) forces the repair loop to
	 * fire when the LLM emits `[]` or `[""]` (the most common warning we saw
	 * in production logs before this tightening).
	 */
	what_was_correct: z.array(z.string().min(1)).min(1),
	/**
	 * Why the score is below 100. Empty array is allowed when score === 100;
	 * otherwise must have at least one non-empty item. Conditional enforced
	 * via the parent schema's `.superRefine()` below.
	 */
	where_marks_were_lost: z.array(z.string().min(1)).default([]),
	/**
	 * One sentence on how to reach the next score band. Empty allowed only
	 * when score === 100. Conditional enforced via `.superRefine()` below.
	 */
	to_reach_next_band: z.string().default(""),
	/** Required for long_answer when score < 100; must have exactly 5 rows summing to score. */
	criterion_scores: z.array(gradedCriterionScoreSchema).optional(),
}).superRefine((item, ctx) => {
	// Conditional invariants on the score < 100 branch. Putting these here (vs
	// the field level) lets us reference `score` from the same object.
	if (item.score < 100) {
		if (item.where_marks_were_lost.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["where_marks_were_lost"],
				message: "where_marks_were_lost must have at least one item when score < 100",
			});
		}
		if (item.to_reach_next_band.trim().length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["to_reach_next_band"],
				message: "to_reach_next_band must be non-empty when score < 100",
			});
		}
	}
});

export type GradedQuestionItem = z.infer<typeof gradedQuestionItemSchema>;

export const gradingChunkSchema = z.object({
	questions: z.array(gradedQuestionItemSchema),
});

export const practiceGradingSummarySchema = z.object({
	overall_summary: z.string(),
	strengths: z.array(z.string()).default([]),
	improvement_areas: z.array(z.string()).default([]),
	recommendations: z.array(z.string()).default([]),
	ai_insights: z.string(),
});

export type PracticeGradingSummary = z.infer<typeof practiceGradingSummarySchema>;
