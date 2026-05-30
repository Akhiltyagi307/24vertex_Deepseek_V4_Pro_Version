import "server-only";

import { NextResponse } from "next/server";

/**
 * Canonical admin API response envelopes.
 *
 * Before this module, admin route handlers returned a mix of
 *   `{ data: rows, total, page, page_size }`
 *   `{ data: row }`
 *   `{ ok: true }`
 *   `{ error: "..." }`
 *   `{ error: { fieldErrors: {...} } }`
 * with no centralized shape. Clients had to special-case each route, and tests
 * couldn't share assertion helpers. The four helpers below replace that
 * sprawl with a single, typed surface so every admin endpoint speaks the same
 * shape:
 *
 *   list  → `{ data: T[], total, page, page_size }`
 *   detail → `{ data: T }`
 *   ack    → `{ ok: true, ... }`
 *   error  → `{ error: string, code?: string, details?: unknown }`
 *
 * Every response sets `X-Robots-Tag: noindex, nofollow` so admin pages and
 * downloads never end up in a search index. Callers that need extra headers
 * pass them via the `headers` option; we merge them on top of the admin
 * defaults.
 *
 * The HTTP status defaults match common admin route patterns (200 for reads
 * and acks, 400 for validation errors). Override with `status` when needed
 * (e.g. 403 / 409 / 502).
 */

export const ADMIN_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
	"X-Robots-Tag": "noindex, nofollow",
});

function mergeHeaders(extra?: HeadersInit): HeadersInit {
	if (!extra) return { ...ADMIN_RESPONSE_HEADERS };
	const merged = new Headers(ADMIN_RESPONSE_HEADERS);
	const more = new Headers(extra);
	more.forEach((value, key) => merged.set(key, value));
	return merged;
}

export type AdminListEnvelope<T> = {
	data: T[];
	total: number;
	page: number;
	page_size: number;
};

export type AdminDetailEnvelope<T> = {
	data: T;
};

export type AdminAckEnvelope = {
	ok: true;
	[extra: string]: unknown;
};

export type AdminErrorEnvelope = {
	// B3 unification: canonical `{ success, code, message }` fields so every API
	// route (admin + student + billing) shares one error shape a client can
	// branch on via `success`/`code`. `error` is kept as a legacy alias (== message)
	// so existing admin clients/tests that read `.error` keep working; remove it
	// in a follow-up once those readers migrate to `message`.
	success: false;
	code?: string;
	message: string;
	error: string;
	details?: unknown;
};

export interface AdminResponseOptions {
	status?: number;
	headers?: HeadersInit;
}

export function adminListResponse<T>(
	body: { data: T[]; total: number; page: number; pageSize: number },
	opts: AdminResponseOptions = {},
): NextResponse<AdminListEnvelope<T>> {
	const envelope: AdminListEnvelope<T> = {
		data: body.data,
		total: body.total,
		page: body.page,
		page_size: body.pageSize,
	};
	return NextResponse.json(envelope, {
		status: opts.status ?? 200,
		headers: mergeHeaders(opts.headers),
	});
}

export function adminDetailResponse<T>(data: T, opts: AdminResponseOptions = {}): NextResponse<AdminDetailEnvelope<T>> {
	return NextResponse.json({ data } satisfies AdminDetailEnvelope<T>, {
		status: opts.status ?? 200,
		headers: mergeHeaders(opts.headers),
	});
}

export function adminAckResponse(
	extra: Record<string, unknown> = {},
	opts: AdminResponseOptions = {},
): NextResponse<AdminAckEnvelope> {
	return NextResponse.json({ ok: true, ...extra } satisfies AdminAckEnvelope, {
		status: opts.status ?? 200,
		headers: mergeHeaders(opts.headers),
	});
}

export function adminErrorResponse(
	message: string,
	opts: AdminResponseOptions & { code?: string; details?: unknown } = {},
): NextResponse<AdminErrorEnvelope> {
	const body: AdminErrorEnvelope = { success: false, message, error: message };
	if (opts.code) body.code = opts.code;
	if (opts.details !== undefined) body.details = opts.details;
	return NextResponse.json(body, {
		status: opts.status ?? 400,
		headers: mergeHeaders(opts.headers),
	});
}

export const adminHeaders = mergeHeaders;
