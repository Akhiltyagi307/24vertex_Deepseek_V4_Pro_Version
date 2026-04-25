/**
 * Whole days until trial end. Matches `daysUntil` in `entitlements.ts` so
 * client surfaces can recompute from `trialEndsAt` when the layout snapshot is
 * stale (e.g. client navigation without re-running the server layout).
 */
export function trialDaysLeftFromEnd(iso: string | null, nowMs: number = Date.now()): number | null {
	if (!iso) return null;
	const ms = new Date(iso).getTime() - nowMs;
	return Math.max(0, Math.ceil(ms / 86_400_000));
}
