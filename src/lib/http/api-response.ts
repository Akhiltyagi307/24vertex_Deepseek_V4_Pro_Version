import "server-only";

import { NextResponse } from "next/server";

import { REQUEST_ID_HEADER } from "./request-id";

/**
 * Standard JSON response envelope for API routes.
 *
 *   success: true  → { data: T, requestId?: string }
 *   success: false → { code: string, message: string, requestId?: string, ... }
 *
 * Lets clients branch on `success` once instead of guessing per-endpoint
 * shapes (some routes today return {error}, others {ok, message}, others
 * {error, code, paywall}, etc.). New routes should use these helpers; old
 * routes can migrate opportunistically.
 *
 * The request id is auto-pulled from the incoming request when given, so
 * client-side error reports can echo it back to support and ops can grep
 * the same id across Next + Sentry + structured logs.
 */

export interface ApiSuccess<T> {
	success: true;
	data: T;
	requestId?: string;
}

export interface ApiFailure {
	success: false;
	code: string;
	message: string;
	requestId?: string;
}

/**
 * Recommended stable `code` values for {@link fail} (B3 unification). Advisory
 * only — the `code` param stays `string` so existing call sites with bespoke
 * codes still compile; prefer these on new/converted routes so clients can
 * branch on `code` reliably across the whole API surface.
 */
export type ApiErrorCode =
	| "validation_error"
	| "unauthorized"
	| "forbidden"
	| "not_found"
	| "rate_limited"
	| "quota_tests"
	| "quota_tokens"
	| "trial_expired"
	| "subscription_expired"
	| "paywall"
	| "conflict"
	| "bad_signature"
	| "database_error"
	| "internal_error";

interface ResponseOptions {
	/** When provided, the response includes the correlation id and echoes it as the x-request-id response header. */
	request?: Request;
	/** Additional response headers. */
	headers?: HeadersInit;
}

function maybeRequestId(request: Request | undefined): string | undefined {
	if (!request) return undefined;
	const id = request.headers.get(REQUEST_ID_HEADER);
	return id ?? undefined;
}

function buildHeaders(request: Request | undefined, extra: HeadersInit | undefined): HeadersInit | undefined {
	const id = maybeRequestId(request);
	if (!id && !extra) return undefined;
	const h = new Headers(extra);
	if (id && !h.has(REQUEST_ID_HEADER)) h.set(REQUEST_ID_HEADER, id);
	return h;
}

/** 200 OK with `{ success: true, data }`. Pass `request` so the response includes the request id. */
export function ok<T>(data: T, opts: ResponseOptions = {}): NextResponse<ApiSuccess<T>> {
	const body: ApiSuccess<T> = { success: true, data };
	const requestId = maybeRequestId(opts.request);
	if (requestId) body.requestId = requestId;
	return NextResponse.json(body, {
		status: 200,
		headers: buildHeaders(opts.request, opts.headers),
	});
}

interface FailOptions extends ResponseOptions {
	/** HTTP status. Defaults to 400. */
	status?: number;
	/** Extra fields merged into the response body (e.g. `{ paywall: true }`). */
	extra?: Record<string, unknown>;
}

/**
 * Failure response with `{ success: false, code, message, ...extra }`.
 *
 * - `code` is a stable string the client matches on (e.g. "rate_limited",
 *   "quota_tokens", "validation_error"). Don't put human-readable text here.
 * - `message` is the human-readable copy that may be displayed to the user.
 *   Don't leak stack traces or DB error details.
 */
export function fail(
	code: string,
	message: string,
	opts: FailOptions = {},
): NextResponse<ApiFailure & Record<string, unknown>> {
	const body: ApiFailure & Record<string, unknown> = {
		success: false,
		code,
		message,
		...(opts.extra ?? {}),
	};
	const requestId = maybeRequestId(opts.request);
	if (requestId) body.requestId = requestId;
	return NextResponse.json(body, {
		status: opts.status ?? 400,
		headers: buildHeaders(opts.request, opts.headers),
	});
}
