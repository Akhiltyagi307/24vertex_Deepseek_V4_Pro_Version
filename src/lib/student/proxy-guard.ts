import { type NextRequest, NextResponse } from "next/server";

import { originAllowed } from "@/lib/security/origin-guard";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth CSRF gate for `/api/student/*` mutating routes.
 *
 * SameSite=Lax on the Supabase auth cookie blocks most cross-origin POSTs,
 * but a malicious site can still smuggle top-level navigations and reuse the
 * student's session for state-changing requests (practice answers, doubt-chat
 * messages, notification mutations, settings writes). Reject mismatched Origin
 * before the handler runs. Server-to-server fetches (no Origin header) pass
 * through.
 */
export function studentProxyGate(request: NextRequest): NextResponse | null {
	const { pathname } = request.nextUrl;
	if (!pathname.startsWith("/api/student/")) return null;
	if (!MUTATION_METHODS.has(request.method)) return null;
	if (originAllowed(request)) return null;

	return NextResponse.json(
		{ ok: false, code: "student_origin_mismatch", message: "Forbidden." },
		{ status: 403 },
	);
}
