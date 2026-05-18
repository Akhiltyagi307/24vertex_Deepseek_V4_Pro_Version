import { type NextRequest, NextResponse } from "next/server";

import { originAllowed } from "@/lib/security/origin-guard";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth CSRF gate for `/api/parent/*` mutating routes.
 *
 * SameSite=Lax on the Supabase auth cookie blocks most cross-origin POSTs,
 * but a malicious site can still smuggle top-level navigations. Reject
 * mismatched Origin before the handler runs so the parent's session is
 * never reused by a CSRF attacker (e.g. spurious notification mutations,
 * unlink actions). Server-to-server fetches (no Origin header) pass through.
 */
export function parentProxyGate(request: NextRequest): NextResponse | null {
	const { pathname } = request.nextUrl;
	if (!pathname.startsWith("/api/parent/")) return null;
	if (!MUTATION_METHODS.has(request.method)) return null;
	if (originAllowed(request)) return null;

	return NextResponse.json(
		{ ok: false, code: "parent_origin_mismatch", message: "Forbidden." },
		{ status: 403 },
	);
}
