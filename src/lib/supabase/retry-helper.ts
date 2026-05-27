/**
 * Generic retry helper for transient Supabase failures.
 *
 * We observed in production (2026-05-27) that the first request to
 * `/student/practice` after a dev-server restart consistently returns
 * "Could not load practice data" — Supabase RPC and table-read calls hit
 * a cold-start race window and surface as `fetch failed` errors. Subsequent
 * requests succeed. Without a retry, the entire page renders the error
 * fallback and the user has to refresh manually. Production cold starts
 * (Vercel) hit the same window.
 *
 * This helper wraps any async Supabase call with bounded retries using a
 * small backoff (`50ms, 200ms, 600ms`). Returns the first successful result
 * or rethrows the last error if all attempts fail.
 *
 * NOTE: Use for IDEMPOTENT reads only (RPC queries, table selects). Do NOT
 * use to wrap inserts/updates/deletes — those should fail fast and propagate.
 */

const DEFAULT_DELAYS_MS: readonly number[] = [50, 200, 600];

export type WithSupabaseRetryOptions = {
	/** Custom delay schedule (ms). Default: [50, 200, 600] (3 retries). */
	delaysMs?: readonly number[];
	/**
	 * Optional context tag for any observability hooks the caller wants to
	 * thread through (we don't log here — caller decides). Free-form.
	 */
	context?: string;
};

/**
 * Run `fn`, retrying on rejection up to `delaysMs.length` times with the
 * specified backoff. Returns the first successful resolution; rethrows the
 * last error if all attempts fail.
 *
 * The function does NOT inspect the error to decide whether to retry — it
 * retries every rejection. Caller-side discrimination (e.g. retry only on
 * Supabase `code: "PGRST*"` codes vs Postgres unique-constraint errors) is
 * out of scope; this helper is for transient fetch-layer failures.
 *
 * @example
 *   const { data, error } = await withSupabaseRetry(
 *     () => supabase.from("topics").select("id, name"),
 *     { context: "load-practice-page.topics" },
 *   );
 */
export async function withSupabaseRetry<T>(
	fn: () => PromiseLike<T>,
	options: WithSupabaseRetryOptions = {},
): Promise<T> {
	const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
	let lastErr: unknown;
	for (let attempt = 0; attempt <= delays.length; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (attempt < delays.length) {
				await sleep(delays[attempt]!);
			}
		}
	}
	throw lastErr;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pattern in error messages that indicates a TRANSIENT network/fetch
 * failure worth retrying. Excludes Postgres schema/permission/uniqueness
 * errors (those should fail fast and propagate).
 */
const TRANSIENT_ERROR_PATTERN = /fetch failed|ECONNREFUSED|ETIMEDOUT|ECONNRESET|socket hang up|other side closed|network|timeout/i;

export function isTransientSupabaseError(error: { message?: unknown } | null | undefined): boolean {
	if (!error || typeof error.message !== "string") return false;
	return TRANSIENT_ERROR_PATTERN.test(error.message);
}

/**
 * Supabase-result-aware retry variant. The Supabase JS client catches
 * network-level fetch failures and returns them as `{ data: null, error }`
 * (it does NOT throw). So plain `withSupabaseRetry` wouldn't trigger on a
 * fetch-failed `rpc()` call. This variant unwraps the Supabase shape,
 * detects transient errors via `isTransientSupabaseError`, and re-throws
 * them so the underlying retry loop fires.
 *
 * Non-transient errors (PostgREST schema mismatches, permission denials,
 * uniqueness violations, etc.) are returned untouched — the caller decides
 * how to handle them.
 */
export async function withSupabaseQueryRetry<T>(
	fn: () => PromiseLike<T>,
	options: WithSupabaseRetryOptions = {},
): Promise<T> {
	return withSupabaseRetry(async () => {
		const result = await fn();
		// Narrow at use-site: only inspect `.error` when the result actually
		// looks like a Supabase response shape. Keeps the generic `T` open so
		// callers get back the full PostgrestSingleResponse / similar with
		// `data`, `count`, `status`, etc. intact.
		if (
			result &&
			typeof result === "object" &&
			"error" in result &&
			isTransientSupabaseError(
				(result as { error?: { message?: unknown } | null }).error ?? null,
			)
		) {
			const err = (result as { error?: { message?: unknown } | null }).error;
			const message =
				typeof err?.message === "string" ? err.message : "transient_supabase_error";
			throw new Error(message);
		}
		return result;
	}, options);
}
