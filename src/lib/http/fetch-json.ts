import * as Sentry from "@sentry/nextjs";
import type { z } from "zod";

import { safeParseOrError } from "@/lib/validations/parse";

/**
 * Client-safe JSON fetch helper. (Kept separate from `./api-response`, which is
 * `server-only`.) Centralises the things every client `fetch` should do but
 * most forget: throw on `!res.ok` (surfacing a `{ message }`/`{ error }` body),
 * optionally validate the parsed body against a zod schema, and report failures
 * to Sentry with consistent tags — while letting `AbortError` pass through
 * silently so callers can cancel without noise.
 */

export type SentryTags = { area: string; op: string };

export class FetchJsonError extends Error {
	readonly status: number | null;
	readonly code: string | null;
	constructor(
		message: string,
		opts: { status?: number | null; code?: string | null; cause?: unknown } = {},
	) {
		super(message);
		this.name = "FetchJsonError";
		this.status = opts.status ?? null;
		this.code = opts.code ?? null;
		if (opts.cause !== undefined) this.cause = opts.cause;
	}
}

export type FetchJsonOptions<T> = {
	/** When provided, the parsed body is validated and the result is typed `T`. */
	schema?: z.ZodType<T, z.ZodTypeDef, unknown>;
	/** Abort signal; an aborted request rejects with the original `AbortError`. */
	signal?: AbortSignal;
	/** Extra `fetch` init (method, headers, body, cache…). Defaults to `cache: "no-store"`. */
	init?: RequestInit;
	/** When set, non-abort failures are reported to Sentry with these tags. */
	report?: SentryTags;
};

export function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Fetch + parse JSON with consistent error handling. Resolves with the parsed
 * (and, if `schema` is given, validated) body, or rejects with a
 * {@link FetchJsonError} — except aborts, which reject with the raw `AbortError`.
 */
export async function fetchJson<T>(input: string, options: FetchJsonOptions<T> = {}): Promise<T> {
	const { schema, signal, init, report } = options;

	let res: Response;
	try {
		res = await fetch(input, { cache: "no-store", ...init, signal });
	} catch (err) {
		if (isAbortError(err)) throw err;
		if (report) Sentry.captureException(err, { tags: report });
		throw new FetchJsonError("Network request failed.", { cause: err });
	}

	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as
			| { message?: string; error?: string; code?: string }
			| null;
		const message = body?.message ?? body?.error ?? `Request failed (status ${res.status}).`;
		const error = new FetchJsonError(message, { status: res.status, code: body?.code ?? null });
		if (report) Sentry.captureException(error, { tags: report, extra: { status: res.status } });
		throw error;
	}

	const json = (await res.json()) as unknown;
	if (!schema) return json as T;

	const parsed = safeParseOrError(schema, json);
	if (!parsed.ok) {
		const error = new FetchJsonError(parsed.error, { status: res.status, code: "validation_error" });
		if (report) Sentry.captureException(error, { tags: report, extra: { issues: parsed.issues } });
		throw error;
	}
	return parsed.data;
}
