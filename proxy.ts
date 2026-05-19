import { type NextRequest, NextResponse } from "next/server";

import { shouldRedirectToMaintenance } from "@/lib/admin/maintenance-routing";
import { adminProxyGate } from "@/lib/admin/proxy-guard";
import { billingProxyGate } from "@/lib/billing/proxy-guard";
import { parentProxyGate } from "@/lib/parent/proxy-guard";
import { CSP_NONCE_REQUEST_HEADER, buildCsp, generateCspNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/session";
import { teacherProxyGate } from "@/lib/teachers/proxy-guard";

/** Root request proxy (Next.js `proxy.ts` convention). Runs on the Node.js runtime. */

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

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const requestId = resolveRequestId(request);
	const nonce = generateCspNonce();
	const csp = buildCsp(nonce);

	const adminEarly = await adminProxyGate(request);
	if (adminEarly) {
		adminEarly.headers.set(REQUEST_ID_HEADER, requestId);
		adminEarly.headers.set("Content-Security-Policy", csp);
		return adminEarly;
	}

	const billingEarly = billingProxyGate(request);
	if (billingEarly) {
		billingEarly.headers.set(REQUEST_ID_HEADER, requestId);
		billingEarly.headers.set("Content-Security-Policy", csp);
		return billingEarly;
	}

	const parentEarly = parentProxyGate(request);
	if (parentEarly) {
		parentEarly.headers.set(REQUEST_ID_HEADER, requestId);
		parentEarly.headers.set("Content-Security-Policy", csp);
		return parentEarly;
	}

	const teacherEarly = teacherProxyGate(request);
	if (teacherEarly) {
		teacherEarly.headers.set(REQUEST_ID_HEADER, requestId);
		teacherEarly.headers.set("Content-Security-Policy", csp);
		return teacherEarly;
	}

	if (shouldRedirectToMaintenance(pathname, process.env.MAINTENANCE_MODE)) {
		const url = request.nextUrl.clone();
		url.pathname = "/maintenance";
		const redirect = NextResponse.redirect(url);
		redirect.headers.set(REQUEST_ID_HEADER, requestId);
		redirect.headers.set("Content-Security-Policy", csp);
		return redirect;
	}

	// Forward both the CSP nonce and the request id to downstream RSC / route
	// handlers via mutated request headers. Server components read the nonce
	// via headers().get('x-nonce'); route handlers read request.headers.get(
	// 'x-request-id') for Sentry / structured-log correlation.
	const response = await updateSession(request, {
		extraRequestHeaders: {
			[CSP_NONCE_REQUEST_HEADER]: nonce,
			[REQUEST_ID_HEADER]: requestId,
		},
	});
	response.headers.set(REQUEST_ID_HEADER, requestId);
	response.headers.set("Content-Security-Policy", csp);
	return response;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
