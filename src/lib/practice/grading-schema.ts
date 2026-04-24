import { z } from "zod";

/** Single question result from the AI grader (one chunk). */
export const gradedQuestionItemSchema = z.object({
	question_id: z.string().uuid(),
	topic_id: z.string().uuid(),
	user_answer_summary: z.string(),
	reference_answer_summary: z.string(),
	verdict: z.enum(["correct", "partially_correct", "incorrect"]),
	analysis: z.string(),
	step_by_step_solution: z.string().optional(),
	score: z.number().min(0).max(100),
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
