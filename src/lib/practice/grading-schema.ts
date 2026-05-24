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
	/** Student-facing label, e.g. "Partial credit (50% band)". */
	band_label: z.string(),
	/** What the student did well (at least one item; use "Full credit on this item." when score is 100). */
	what_was_correct: z.array(z.string()).default([]),
	/** Why the score is below 100; empty array only when score is 100. */
	where_marks_were_lost: z.array(z.string()).default([]),
	/** One sentence on how to reach the next score band; empty only when score is 100. */
	to_reach_next_band: z.string().default(""),
	/** Required for long_answer when score < 100; must have exactly 5 rows summing to score. */
	criterion_scores: z.array(gradedCriterionScoreSchema).optional(),
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
