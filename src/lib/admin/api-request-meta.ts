import type { NextRequest } from "next/server";

/**
 * Best-effort client IP from proxy / platform headers. Matches login + RSC + API checks.
 * Prefer `x-forwarded-for` (first hop); then `x-real-ip`, Vercel, Cloudflare; else `0.0.0.0`
 * so allowlist logic matches between Route Handlers and `headers()` in Server Components.
 */
export function clientIpFromHeaders(h: Headers): string {
	const xff = h.get("x-forwarded-for");
	if (xff) {
		const first = xff.split(",")[0]?.trim();
		if (first) return first;
	}
	const realIp = h.get("x-real-ip")?.trim();
	if (realIp) return realIp;
	const vercelFwd = h.get("x-vercel-forwarded-for");
	if (vercelFwd) {
		const first = vercelFwd.split(",")[0]?.trim();
		if (first) return first;
	}
	const cf = h.get("cf-connecting-ip")?.trim();
	if (cf) return cf;
	return "0.0.0.0";
}

export function clientIpFromRequest(request: NextRequest): string {
	return clientIpFromHeaders(request.headers);
}

export function userAgentFromRequest(request: NextRequest): string {
	return request.headers.get("user-agent") ?? "";
}
