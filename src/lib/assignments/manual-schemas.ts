import { z } from "zod";

import { isAssignmentDueAtInPast } from "@/lib/assignments/assignment-due-at";
import { practiceDifficultySchema } from "@/lib/practice";

export const MANUAL_ASSIGNMENT_MAX_QUESTIONS = 50;
export const MANUAL_ASSIGNMENT_MIN_TIME_LIMIT_SECONDS = 300; // 5 min
export const MANUAL_ASSIGNMENT_MAX_TIME_LIMIT_SECONDS = 14400; // 4 h

const optionalTextToNull = z
	.string()
	.nullish()
	.transform((value) => {
		if (value == null) return null;
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	});

const optionLetters = ["A", "B", "C", "D", "E", "F"] as const;
export type ManualOptionLetter = (typeof optionLetters)[number];

const trimmedNonEmpty = z.string().trim().min(1);
const trimmedList = z.array(trimmedNonEmpty).optional();

const mcqOptionsSchema = z
	.object({
		A: trimmedNonEmpty,
		B: trimmedNonEmpty,
		C: trimmedNonEmpty.optional(),
		D: trimmedNonEmpty.optional(),
		E: trimmedNonEmpty.optional(),
		F: trimmedNonEmpty.optional(),
	})
	.strict();

const mcqAnswerKeySchema = z
	.object({
		correct_answer: z.enum(optionLetters),
		explanation: z.string().trim().optional(),
		distractor_rationale: z.record(z.enum(optionLetters), z.string()).optional(),
	})
	.strip();

const fillBlankAnswerKeySchema = z
	.object({
		correct_answer: trimmedNonEmpty,
		acceptable_variants: trimmedList,
		explanation: z.string().trim().optional(),
	})
	.strip();

const numericalAnswerKeySchema = z
	.object({
		correct_answer: trimmedNonEmpty.refine((v) => Number.isFinite(Number(v)), "Enter a numeric answer."),
		tolerance: z.number().nonnegative().optional(),
		units: z.string().trim().optional(),
		explanation: z.string().trim().optional(),
	})
	.strip();

const openEndedAnswerKeySchema = z
	.object({
		model_answer: z.string().trim().optional(),
		marking_points: trimmedList,
		full_credit_requires: trimmedList,
		acceptable_variants: trimmedList,
		expected_misanswers: z.array(z.object({ answer: trimmedNonEmpty, why: trimmedNonEmpty })).optional(),
	})
	.strip()
	.refine(
		(k) =>
			(k.model_answer && k.model_answer.trim().length > 0) ||
			(k.marking_points && k.marking_points.length > 0) ||
			(k.full_credit_requires && k.full_credit_requires.length > 0),
		{ message: "Add a model answer or at least one marking point so the AI can grade this." },
	);

const baseQuestionFields = {
	topic_id: z.string().uuid({ message: "Pick a chapter & topic for this question." }),
	question_text: z.string().trim().min(1, "Write the question.").max(8000),
	difficulty_level: practiceDifficultySchema.default("medium"),
};

const mcqQuestionSchema = z
	.object({
		question_type: z.literal("multiple_choice"),
		...baseQuestionFields,
		options: mcqOptionsSchema,
		answer_key: mcqAnswerKeySchema,
	})
	.strict();

const fillBlankQuestionSchema = z
	.object({ question_type: z.literal("fill_in_blank"), ...baseQuestionFields, answer_key: fillBlankAnswerKeySchema })
	.strict();

const numericalQuestionSchema = z
	.object({ question_type: z.literal("numerical"), ...baseQuestionFields, answer_key: numericalAnswerKeySchema })
	.strict();

const shortAnswerQuestionSchema = z
	.object({ question_type: z.literal("short_answer"), ...baseQuestionFields, answer_key: openEndedAnswerKeySchema })
	.strict();

const longAnswerQuestionSchema = z
	.object({ question_type: z.literal("long_answer"), ...baseQuestionFields, answer_key: openEndedAnswerKeySchema })
	.strict();

/**
 * Discriminated union of the five question types. The MCQ "correct answer must be
 * one of the options" rule is applied with a UNION-LEVEL superRefine — Zod requires
 * discriminatedUnion members to be plain ZodObjects, so the refinement cannot live
 * on the member itself.
 */
export const manualQuestionInputSchema = z
	.discriminatedUnion("question_type", [
		mcqQuestionSchema,
		fillBlankQuestionSchema,
		numericalQuestionSchema,
		shortAnswerQuestionSchema,
		longAnswerQuestionSchema,
	])
	.superRefine((q, ctx) => {
		if (q.question_type === "multiple_choice") {
			if (!(q.answer_key.correct_answer in q.options)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["answer_key", "correct_answer"],
					message: "The correct answer must be one of the options you wrote.",
				});
			}
		}
	});

export type ManualQuestionInput = z.infer<typeof manualQuestionInputSchema>;

export const manualAssignmentConfigSchema = z
	.object({
		v: z.literal(1),
		kind: z.literal("practice_test"),
		authoring_mode: z.literal("manual"),
		subject_id: z.string().uuid(),
		topic_ids: z.array(z.string().uuid()).min(1).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		difficulty: practiceDifficultySchema.default("medium"),
		question_count: z.number().int().min(1).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		time_limit_seconds: z
			.number()
			.int()
			.min(MANUAL_ASSIGNMENT_MIN_TIME_LIMIT_SECONDS)
			.max(MANUAL_ASSIGNMENT_MAX_TIME_LIMIT_SECONDS),
	})
	.strict();

export type ManualAssignmentConfig = z.infer<typeof manualAssignmentConfigSchema>;

const dueAtSchema = optionalTextToNull
	.refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Enter a valid due date.")
	.refine((v) => v === null || !isAssignmentDueAtInPast(v), "Due date must be in the future.");

const manualHeaderFields = {
	title: z.string().trim().min(1, "Enter an assignment title.").max(300),
	instructions: optionalTextToNull,
	subject_id: z.string().uuid(),
	difficulty: practiceDifficultySchema.default("medium"),
	time_limit_seconds: z
		.number()
		.int()
		.min(MANUAL_ASSIGNMENT_MIN_TIME_LIMIT_SECONDS)
		.max(MANUAL_ASSIGNMENT_MAX_TIME_LIMIT_SECONDS),
	due_at: dueAtSchema,
};

export const createManualAssignmentInputSchema = z
	.object({
		...manualHeaderFields,
		questions: z
			.array(manualQuestionInputSchema)
			.min(1, "Add at least one question.")
			.max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		student_ids: z.array(z.string().uuid()).min(1, "Select at least one student."),
	})
	.strict();

export type CreateManualAssignmentInput = z.infer<typeof createManualAssignmentInputSchema>;

export const saveManualAssignmentDraftInputSchema = z
	.object({
		assignment_id: z.string().uuid().nullish(),
		...manualHeaderFields,
		questions: z.array(manualQuestionInputSchema).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		student_ids: z.array(z.string().uuid()),
	})
	.strict();

export type SaveManualAssignmentDraftInput = z.infer<typeof saveManualAssignmentDraftInputSchema>;

export const updateManualAssignmentInputSchema = z
	.object({
		assignment_id: z.string().uuid(),
		...manualHeaderFields,
		questions: z.array(manualQuestionInputSchema).min(1).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
	})
	.strict();

export type UpdateManualAssignmentInput = z.infer<typeof updateManualAssignmentInputSchema>;
