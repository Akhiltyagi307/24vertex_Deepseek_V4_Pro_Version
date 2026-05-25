import { z } from "zod";

/** Reject unknown query keys on GET routes that accept no parameters. */
export const strictEmptyQuerySchema = z.object({}).strict();

export function searchParamsToRecord(searchParams: URLSearchParams): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of searchParams.entries()) out[k] = v;
	return out;
}

export function parseStrictEmptyQuery(
	searchParams: URLSearchParams,
): { ok: true } | { ok: false; error: string } {
	const parsed = strictEmptyQuerySchema.safeParse(searchParamsToRecord(searchParams));
	if (!parsed.success) {
		return { ok: false, error: "Invalid query parameters." };
	}
	return { ok: true };
}

export const studentNotificationsListQuerySchema = z
	.object({
		cursor: z.string().max(500).optional(),
		filter: z.enum(["all", "unread"]).optional(),
		limit: z.string().regex(/^\d+$/).optional(),
	})
	.strict();

export const reportPdfParamsSchema = z.object({ testId: z.string().uuid() }).strict();

export const reportPdfQuerySchema = z
	.object({
		disposition: z.enum(["inline", "attachment"]).optional(),
		view: z.enum(["1"]).optional(),
		inline: z.enum(["1"]).optional(),
	})
	.strict();

export const qnaNavDirectionSchema = z.enum(["next", "prev"]);
