import { z } from "zod";

import { isAssignmentDueAtInPast } from "@/lib/assignments/assignment-due-at";
import { practiceDifficultySchema } from "@/lib/practice";

const optionalTextToNull = z
	.string()
	.nullish()
	.transform((value) => {
		if (value == null) return null;
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	});

export const assignmentKindSchema = z.literal("practice_test");

export const assignmentLifecycleStatusSchema = z.enum([
	"pending_materialize",
	"ready",
	"in_progress",
	"submitted",
	"grading",
	"graded",
	"failed_generation",
	"grading_failed",
	"late",
	"excused",
]);

export const assignmentStatusSchema = z.enum(["draft", "published", "archived"]);

export const assignmentConfigSchema = z
	.object({
		v: z.literal(1),
		kind: assignmentKindSchema,
		subject_id: z.string().uuid(),
		topic_ids: z.array(z.string().uuid()).min(1, "Select at least one topic.").max(20),
		difficulty: practiceDifficultySchema.default("medium"),
		question_count: z.union([z.literal(15), z.literal(30)]).default(15),
		time_limit_seconds: z.union([z.literal(3600), z.literal(10800)]).default(3600),
	})
	.strict()
	.superRefine((value, ctx) => {
		const unique = new Set(value.topic_ids);
		if (unique.size !== value.topic_ids.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["topic_ids"],
				message: "Each topic can only be selected once.",
			});
		}
		if (
			(value.time_limit_seconds === 3600 && value.question_count !== 15) ||
			(value.time_limit_seconds === 10800 && value.question_count !== 30)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["question_count"],
				message: "Question count must match the selected duration.",
			});
		}
	});

export type AssignmentConfig = z.infer<typeof assignmentConfigSchema>;

/**
 * Lenient parser used by read paths that only need `subject_id` + `authoring_mode`.
 * Tolerates BOTH the strict AI config and the manual config (and any future shape)
 * via `.passthrough()`, so manual assignments are never dropped from lists.
 * Existing rows without `authoring_mode` are treated as AI.
 */
export const assignmentConfigBaseSchema = z
	.object({
		subject_id: z.string().uuid(),
		authoring_mode: z.enum(["ai", "manual"]).default("ai"),
		topic_ids: z.array(z.string().uuid()).optional(),
	})
	.passthrough();

export type AssignmentConfigBase = z.infer<typeof assignmentConfigBaseSchema>;

/**
 * Display-field reader for read paths that show config details for BOTH AI and
 * manual assignments (e.g. the admin assignment list/detail). The strict
 * {@link assignmentConfigSchema} rejects every manual config (manual uses
 * arbitrary `question_count`/`time_limit_seconds` and carries `authoring_mode`),
 * so using it here blanks out subject/difficulty/count/time for manual rows.
 * This reads each field leniently and never throws.
 */
export function readAssignmentConfigDisplayFields(config: unknown): {
	subjectId: string | null;
	topicIds: string[];
	difficulty: string | null;
	questionCount: number | null;
	timeLimitSeconds: number | null;
	authoringMode: "ai" | "manual";
} {
	const base = assignmentConfigBaseSchema.safeParse(config);
	const raw = (config ?? {}) as Record<string, unknown>;
	const subjectId =
		base.success ? base.data.subject_id : typeof raw.subject_id === "string" ? raw.subject_id : null;
	const topicIds =
		base.success && base.data.topic_ids
			? base.data.topic_ids
			: Array.isArray(raw.topic_ids)
				? raw.topic_ids.filter((t): t is string => typeof t === "string")
				: [];
	return {
		subjectId,
		topicIds,
		difficulty: typeof raw.difficulty === "string" ? raw.difficulty : null,
		questionCount: typeof raw.question_count === "number" ? raw.question_count : null,
		timeLimitSeconds: typeof raw.time_limit_seconds === "number" ? raw.time_limit_seconds : null,
		authoringMode: base.success ? base.data.authoring_mode : raw.authoring_mode === "manual" ? "manual" : "ai",
	};
}

export type AssignmentLifecycleStatus = z.infer<typeof assignmentLifecycleStatusSchema>;
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;

export const createAssignmentInputSchema = z
	.object({
		title: z.string().trim().min(1, "Enter an assignment title.").max(300),
		instructions: optionalTextToNull,
		config: assignmentConfigSchema,
		student_ids: z.array(z.string().uuid()).min(1, "Select at least one student."),
		due_at: optionalTextToNull
			.refine(
				(value) => value === null || !Number.isNaN(Date.parse(value)),
				"Enter a valid due date.",
			)
			.refine(
				(value) => value === null || !isAssignmentDueAtInPast(value),
				"Due date must be in the future.",
			),
	})
	.strict();

export type CreateAssignmentInput = z.infer<typeof createAssignmentInputSchema>;

const ASSIGNMENT_JOB_SPACING_MS = 30_000;
const ASSIGNED_GRADING_JITTER_WINDOW_MS = 5 * 60_000;

export function computeAssignmentJobRunAfter(base: Date, index: number): Date {
	return new Date(base.getTime() + Math.max(0, index) * ASSIGNMENT_JOB_SPACING_MS);
}

function deterministicHash(input: string): number {
	let hash = 0;
	for (let i = 0; i < input.length; i += 1) {
		hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
	}
	return hash;
}

export function computeAssignedGradingRunAfter(base: Date, studentId: string): Date {
	const offset = deterministicHash(studentId) % ASSIGNED_GRADING_JITTER_WINDOW_MS;
	return new Date(base.getTime() + offset);
}
