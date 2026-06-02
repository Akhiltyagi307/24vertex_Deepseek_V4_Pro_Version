import { z } from "zod";

/**
 * Runtime shape of usage_periods.pre_pause_quota (JSONB). The column stores the
 * paid quota snapshot taken at pause so resume can restore it. It is written as
 * `{ testsQuota, tokensQuota }`, but JSONB enforces no shape — a code rename or a
 * hand-edited row could silently drift, and resume would then write `undefined`
 * into the integer quota columns (review finding M8). Validate on read.
 */
export const prePauseQuotaSchema = z.object({
	testsQuota: z.number().int().nonnegative(),
	tokensQuota: z.number().int().nonnegative(),
});

export type PrePauseQuota = z.infer<typeof prePauseQuotaSchema>;

/**
 * Parse a raw pre_pause_quota JSONB value. Returns the validated quota, or null
 * when absent or malformed (caller should then skip the restore rather than
 * write garbage into tests_quota / tokens_quota).
 */
export function parsePrePauseQuota(raw: unknown): PrePauseQuota | null {
	if (raw == null) return null;
	const parsed = prePauseQuotaSchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}
