import "server-only";

import * as Sentry from "@sentry/nextjs";

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Read the per-request correlation id that the root proxy (`proxy.ts`) injected and set it as a
 * Sentry tag on the current scope. Route handlers should call this once near
 * the top of the handler so any captured exception inside it carries the id.
 *
 * Returns the id (or null if the proxy didn't run, e.g. unmatched static
 * paths). Safe to call multiple times — Sentry.setTag is idempotent.
 */
export function tagRequestId(request: Request): string | null {
	const id = request.headers.get(REQUEST_ID_HEADER);
	if (!id) return null;
	Sentry.setTag("request_id", id);
	return id;
}
