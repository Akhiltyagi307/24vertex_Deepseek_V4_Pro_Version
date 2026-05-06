import { type NextRequest, NextResponse } from "next/server";

import { originAllowed } from "@/lib/security/origin-guard";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Webhook is server-to-server (Razorpay → us); Origin is absent and we rely
 * on HMAC signature verification instead. Quote is GET-only. Everything else
 * under `/api/billing/*` is user-initiated and must be Origin-checked.
 */
function isBillingPathExemptFromOrigin(pathname: string): boolean {
	return pathname === "/api/billing/webhook";
}

/**
 * W2.2 — defense-in-depth CSRF gate for `/api/billing/*` mutating routes.
 *
 * SameSite=Lax on the auth cookie blocks most cross-origin POSTs but a
 * malicious site that gets a POST through (form-based attacks, top-level
 * navigations) can still trigger spam subscription creation in a victim's
 * session. Without Origin verification, we'd return 401 because there's no
 * session — but the attacker doesn't need the response to do damage.
 *
 * Returns 403 with a clean error when Origin is set and doesn't match. Server
 * -to-server fetches (no Origin header) pass through.
 */
export function billingProxyGate(request: NextRequest): NextResponse | null {
	const { pathname } = request.nextUrl;
	if (!pathname.startsWith("/api/billing")) return null;
	if (!MUTATION_METHODS.has(request.method)) return null;
	if (isBillingPathExemptFromOrigin(pathname)) return null;
	if (originAllowed(request)) return null;

	return NextResponse.json(
		{ ok: false, code: "billing_origin_mismatch", message: "Forbidden." },
		{ status: 403 },
	);
}
