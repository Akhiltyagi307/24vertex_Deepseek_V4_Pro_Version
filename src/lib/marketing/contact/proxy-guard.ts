import { type NextRequest, NextResponse } from "next/server";

import { originAllowed } from "@/lib/security/origin-guard";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth CSRF gate for `/api/contact`.
 *
 * Unlike the role API surfaces, `/api/contact` is unauthenticated — there is
 * no session cookie an attacker could ride. The risk this gate addresses is
 * different: a malicious site driving a victim's browser to submit a contact
 * inquiry with attacker-controlled content (e.g. spam, phishing pretext) from
 * the victim's IP. Same-Origin enforcement plus the existing rate-limit /
 * honeypot makes that attack uneconomical.
 *
 * Server-to-server fetches with no Origin header pass through; the rate-limit
 * in `consumeContactSubmitRateLimit` (per-IP) is the gate for those.
 */
export function contactProxyGate(request: NextRequest): NextResponse | null {
	const { pathname } = request.nextUrl;
	if (!pathname.startsWith("/api/contact")) return null;
	if (!MUTATION_METHODS.has(request.method)) return null;
	if (originAllowed(request)) return null;

	return NextResponse.json(
		{ ok: false, code: "contact_origin_mismatch", message: "Forbidden." },
		{ status: 403 },
	);
}
