import "server-only";

import { NextResponse } from "next/server";

import type { RlConsumeResult } from "./consume";

/** Apply standard rate-limit response headers (RFC-aligned). */
export function applyRlHeaders(
	response: NextResponse,
	result: RlConsumeResult,
	limit: number,
): NextResponse {
	const resetEpoch = Math.ceil(result.resetAt.getTime() / 1000);
	const retryAfter = Math.max(0, resetEpoch - Math.floor(Date.now() / 1000));
	response.headers.set("X-RateLimit-Limit", String(limit));
	response.headers.set("X-RateLimit-Remaining", String(result.remaining));
	response.headers.set("X-RateLimit-Reset", String(resetEpoch));
	if (!result.allowed) {
		response.headers.set("Retry-After", String(retryAfter));
	}
	return response;
}

export interface RateLimitedResponseOptions {
	message?: string;
	code?: string;
}

/** Standard 429 response with rate-limit headers. */
export function rateLimitedResponse(
	result: RlConsumeResult,
	limit: number,
	options: RateLimitedResponseOptions = {},
): NextResponse {
	const body = {
		error: options.code ?? "rate_limited",
		message:
			options.message ?? "Too many requests. Please slow down and try again shortly.",
		resetAt: result.resetAt.toISOString(),
	};
	return applyRlHeaders(NextResponse.json(body, { status: 429 }), result, limit);
}
