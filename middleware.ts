import { type NextRequest, NextResponse } from "next/server";

import { shouldRedirectToMaintenance } from "@/lib/admin/maintenance-routing";
import { adminProxyGate } from "@/lib/admin/proxy-guard";
import { updateSession } from "@/lib/supabase/session";

/** Node.js runtime: matches prior `proxy.ts` behavior and ensures dev emits `server/middleware.js` (Turbopack + `loadNodeMiddleware`). */
export const runtime = "nodejs";

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Honor an upstream-supplied request id (e.g. Vercel edge, load balancer,
 * curl --header) so cross-service correlation works end-to-end. Otherwise
 * mint a fresh UUID. Validating the upstream value against a UUID-ish shape
 * keeps a malicious client from pushing arbitrary log strings into our
 * structured logs.
 */
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

function resolveRequestId(request: NextRequest): string {
	const upstream = request.headers.get(REQUEST_ID_HEADER)?.trim();
	if (upstream && REQUEST_ID_RE.test(upstream)) return upstream;
	return crypto.randomUUID();
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const requestId = resolveRequestId(request);
	// Forward to downstream route handlers — they read it via
	// request.headers.get("x-request-id") and tag Sentry / structured logs.
	request.headers.set(REQUEST_ID_HEADER, requestId);

	const adminEarly = await adminProxyGate(request);
	if (adminEarly) {
		adminEarly.headers.set(REQUEST_ID_HEADER, requestId);
		return adminEarly;
	}

	if (shouldRedirectToMaintenance(pathname, process.env.MAINTENANCE_MODE)) {
		const url = request.nextUrl.clone();
		url.pathname = "/maintenance";
		const redirect = NextResponse.redirect(url);
		redirect.headers.set(REQUEST_ID_HEADER, requestId);
		return redirect;
	}

	const response = await updateSession(request);
	response.headers.set(REQUEST_ID_HEADER, requestId);
	return response;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
