import { z } from "zod";

import { PRACTICE_MIN_TOPICS } from "./constants";

export const practiceDifficultySchema = z.enum(["easy", "medium", "hard"]);

/**
 * Legacy literal duration schema kept for existing test fixtures and
 * backwards compatibility with older client payloads.
 */
export const practiceDurationSecondsSchema = z.union([z.literal(3600), z.literal(10800)]);

/** Self-practice generation: only 1h or 3h. */
export const practiceDurationSecondsInputSchema = z.union([z.literal(3600), z.literal(10800)]);

export const finalizePracticeConfigSchema = z
	.object({
		subjectId: z.string().uuid(),
		trackerIds: z.array(z.string().uuid()),
		difficulty: practiceDifficultySchema,
		durationSeconds: practiceDurationSecondsInputSchema,
	})
	.superRefine((data, ctx) => {
		const unique = new Set(data.trackerIds);
		if (unique.size !== data.trackerIds.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Each topic can only be selected once.",
				path: ["trackerIds"],
			});
		}
		if (data.trackerIds.length < PRACTICE_MIN_TOPICS) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					PRACTICE_MIN_TOPICS === 1 ?
						"Select at least one topic."
					:	`Select at least ${PRACTICE_MIN_TOPICS} topics.`,
				path: ["trackerIds"],
			});
		}
	});

export type FinalizePracticeConfigInput = z.infer<typeof finalizePracticeConfigSchema>;
