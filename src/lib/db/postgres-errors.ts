/**
 * Detect Postgres "too many connections" / pool exhaustion (common with Supabase
 * when DATABASE_URL uses direct :5432 instead of the transaction pooler).
 *
 * Drizzle / driver stacks often wrap the driver error; `AggregateError` may list
 * multiple `errors[]`. We walk `cause` and `errors` so EMAXCONN is still detected.
 */
export function isPostgresTooManyConnectionsError(error: unknown): boolean {
	const queue: unknown[] = [error];
	const seen = new Set<unknown>();

	while (queue.length > 0) {
		const current = queue.shift();
		if (current == null || typeof current !== "object") continue;
		if (seen.has(current)) continue;
		seen.add(current);

		const o = current as { message?: unknown; code?: unknown; cause?: unknown; errors?: unknown };
		const msg = typeof o.message === "string" ? o.message : "";
		if (/max client connections|EMAXCONN|too many clients/i.test(msg)) return true;
		if (o.code === "53300" || o.code === "53400") return true;

		if (o.cause) queue.push(o.cause);
		if (Array.isArray(o.errors)) {
			for (const sub of o.errors) {
				queue.push(sub);
			}
		}
	}

	return false;
}
