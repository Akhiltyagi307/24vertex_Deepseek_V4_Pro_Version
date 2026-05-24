import { type NextRequest, NextResponse } from "next/server";

import { originAllowed } from "@/lib/security/origin-guard";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth CSRF gate for `/api/feedback` mutating routes.
 *
 * `/api/feedback` is authenticated and accepts JSON only, so the browser-side
 * `application/json` preflight already eliminates the simple-request CSRF
 * vector. This gate is the second wall: SameSite=Lax on the Supabase auth
 * cookie still leaks the cookie on top-level POST navigations, and an Origin
 * check rejects those before the handler runs. Server-to-server fetches with
 * no Origin header pass through.
 */
export function feedbackProxyGate(request: NextRequest): NextResponse | null {
	const { pathname } = request.nextUrl;
	if (!pathname.startsWith("/api/feedback")) return null;
	if (!MUTATION_METHODS.has(request.method)) return null;
	if (originAllowed(request)) return null;

	return NextResponse.json(
		{ ok: false, code: "feedback_origin_mismatch", message: "Forbidden." },
		{ status: 403 },
	);
}
