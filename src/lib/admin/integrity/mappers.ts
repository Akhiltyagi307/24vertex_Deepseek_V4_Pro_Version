import "server-only";

import { z } from "zod";

/**
 * D19: typed mapper layer for the integrity check runners. Previously, each
 * check did
 *
 *   const details = rows as unknown as Record<string, unknown>[];
 *
 * 11 times — a footgun if Drizzle's `execute()` shape ever changes or if the
 * column list drifts from the projection. The mapper layer Zod-parses each
 * row at the boundary, returning a properly-typed array. Bad rows are
 * dropped silently (an integrity check is itself best-effort) and a count
 * of dropped rows is exposed via the result so we can investigate.
 */

export interface IntegrityRowsResult<T> {
	rows: T[];
	parsed: number;
	dropped: number;
}

function toRecordArray(input: unknown): Record<string, unknown>[] {
	if (Array.isArray(input)) return input as Record<string, unknown>[];
	if (input && typeof input === "object" && Symbol.iterator in (input as object)) {
		return Array.from(input as Iterable<unknown>) as Record<string, unknown>[];
	}
	return [];
}

export function parseIntegrityRows<T>(
	input: unknown,
	schema: z.ZodType<T>,
): IntegrityRowsResult<T> {
	const raw = toRecordArray(input);
	let parsed = 0;
	let dropped = 0;
	const rows: T[] = [];
	for (const row of raw) {
		const r = schema.safeParse(row);
		if (r.success) {
			rows.push(r.data);
			parsed += 1;
		} else {
			dropped += 1;
		}
	}
	return { rows, parsed, dropped };
}

// ---- Per-check schemas. Loose enough to accept the SQL projection without
// over-constraining (some PG drivers return string IDs, others UUID-typed). ----

export const studentMissingTrackerSchema = z
	.object({ student_id: z.string() })
	.passthrough();
export type StudentMissingTrackerRow = z.infer<typeof studentMissingTrackerSchema>;

export const trackerRowSchema = z
	.object({
		tracker_row_id: z.string(),
		student_id: z.string(),
		topic_id: z.string(),
	})
	.passthrough();
export type TrackerRowRow = z.infer<typeof trackerRowSchema>;

export const testWithoutQuestionsSchema = z
	.object({ test_id: z.string(), student_id: z.string().optional().nullable() })
	.passthrough();
export type TestWithoutQuestionsRow = z.infer<typeof testWithoutQuestionsSchema>;

export const questionWithoutAnswerKeySchema = z
	.object({ question_id: z.string(), test_id: z.string().optional().nullable() })
	.passthrough();
export type QuestionWithoutAnswerKeyRow = z.infer<typeof questionWithoutAnswerKeySchema>;

export const subscriptionWithoutPlanSchema = z
	.object({ subscription_id: z.string(), plan_code: z.string() })
	.passthrough();
export type SubscriptionWithoutPlanRow = z.infer<typeof subscriptionWithoutPlanSchema>;

export const paymentWithoutSubscriptionSchema = z
	.object({
		payment_id: z.string(),
		subscription_id: z.string().nullable().optional(),
	})
	.passthrough();
export type PaymentWithoutSubscriptionRow = z.infer<typeof paymentWithoutSubscriptionSchema>;

export const overlappingUsagePeriodSchema = z
	.object({ usage_period_id: z.string(), subscription_id: z.string() })
	.passthrough();
export type OverlappingUsagePeriodRow = z.infer<typeof overlappingUsagePeriodSchema>;

export const parentLinkDeletedUserSchema = z
	.object({
		link_id: z.string(),
		parent_id: z.string(),
		student_id: z.string(),
	})
	.passthrough();
export type ParentLinkDeletedUserRow = z.infer<typeof parentLinkDeletedUserSchema>;

export const emailLogStuckSchema = z
	.object({
		id: z.union([z.string(), z.number()]),
		created_at: z.union([z.string(), z.date()]).optional(),
	})
	.passthrough();
export type EmailLogStuckRow = z.infer<typeof emailLogStuckSchema>;

export const embeddingDimensionMismatchSchema = z
	.object({ question_id: z.string() })
	.passthrough();
export type EmbeddingDimensionMismatchRow = z.infer<typeof embeddingDimensionMismatchSchema>;

export const topicWithZeroChunksSchema = z
	.object({
		topic_id: z.string(),
		topic_name: z.string().optional().nullable(),
	})
	.passthrough();
export type TopicWithZeroChunksRow = z.infer<typeof topicWithZeroChunksSchema>;
