/**
 * Practice flows call the model with structured output. Transient failures (rate limits,
 * empty responses, schema mismatch) should retry before the user sees an error.
 *
 * `PRACTICE_AI_USER_FACING_RETRIES` is how many *additional* attempts after the first.
 */
export const PRACTICE_AI_USER_FACING_RETRIES = 5;

/** Total model calls per logical operation: one try plus {@link PRACTICE_AI_USER_FACING_RETRIES} retries. */
export const PRACTICE_AI_MAX_ATTEMPTS = 1 + PRACTICE_AI_USER_FACING_RETRIES;

function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attemptIndex: number): number {
	return Math.min(4_000, 250 * 2 ** attemptIndex);
}

/**
 * Retries a function that returns `{ ok, value? | message? }` until success or attempts exhausted.
 * Used when the callee catches errors and returns a message instead of throwing.
 */
export async function repeatPracticeAiResultUntilSuccessOrExhausted<T>(
	label: string,
	attempt: () => Promise<{ ok: true; value: T } | { ok: false; message: string }>,
	options: {
		onFailedAttempt?: (failure: { ok: false; message: string }, attemptNumber: number, totalAttempts: number) => void;
		shouldRetry?: (failure: { ok: false; message: string }, attemptNumber: number, totalAttempts: number) => boolean;
	} = {},
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
	let last: { ok: false; message: string } = { ok: false, message: "Unknown error" };

	for (let i = 0; i < PRACTICE_AI_MAX_ATTEMPTS; i++) {
		const r = await attempt();
		if (r.ok) {
			return r;
		}
		last = r;
		options.onFailedAttempt?.(r, i + 1, PRACTICE_AI_MAX_ATTEMPTS);
		if (process.env.NODE_ENV === "development") {
			console.error(`[${label}] attempt ${i + 1}/${PRACTICE_AI_MAX_ATTEMPTS} failed:`, r.message);
		}
		const shouldRetry = options.shouldRetry?.(r, i + 1, PRACTICE_AI_MAX_ATTEMPTS) ?? true;
		if (i < PRACTICE_AI_MAX_ATTEMPTS - 1 && shouldRetry) {
			await sleepMs(backoffMs(i));
		} else if (!shouldRetry) {
			break;
		}
	}

	return last;
}

/**
 * Retries until the inner function returns or rethrows the last error after exhausting attempts.
 */
export async function withPracticeAiAttempts<T>(label: string, fn: () => Promise<T>): Promise<T> {
	let lastErr: unknown;
	for (let i = 0; i < PRACTICE_AI_MAX_ATTEMPTS; i++) {
		try {
			return await fn();
		} catch (e) {
			lastErr = e;
			if (process.env.NODE_ENV === "development") {
				console.error(`[${label}] attempt ${i + 1}/${PRACTICE_AI_MAX_ATTEMPTS}`, e);
			}
			if (i < PRACTICE_AI_MAX_ATTEMPTS - 1) {
				await sleepMs(backoffMs(i));
			}
		}
	}
	throw lastErr;
}

/**
 * Run `tasks` with at most `concurrency` promises in flight at once. Preserves
 * input order in the resolved array. Throws on the first rejection (same as
 * `Promise.all`).
 */
export async function pLimit<T>(concurrency: number, tasks: Array<() => Promise<T>>): Promise<T[]> {
	const results: T[] = new Array(tasks.length);
	let i = 0;
	async function worker() {
		for (;;) {
			const idx = i++;
			if (idx >= tasks.length) return;
			results[idx] = await tasks[idx]!();
		}
	}
	const n = Math.max(1, Math.min(concurrency, tasks.length));
	await Promise.all(Array.from({ length: n }, () => worker()));
	return results;
}
