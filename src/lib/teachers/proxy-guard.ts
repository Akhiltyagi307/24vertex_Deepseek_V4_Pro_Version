import { type NextRequest, NextResponse } from "next/server";

import { originAllowed } from "@/lib/security/origin-guard";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defense-in-depth CSRF gate for `/api/teacher/*` mutating routes.
 *
 * The Supabase auth cookie is `SameSite=Lax`, which still leaks the cookie on
 * top-level cross-site POST navigations. Without Origin verification, an
 * attacker can drive a logged-in teacher's browser to mutate teacher state
 * (e.g. create an assignment, link/unlink a student) via a top-level form
 * submission from a malicious page.
 *
 * Today the only published `/api/teacher/*` route is `reports/[testId]/pdf`
 * (GET-only) — so this gate is forward-compat scaffolding that matches the
 * admin/billing posture. Server-to-server fetches (no Origin header) pass
 * through; same-origin requests pass through.
 */
export function teacherProxyGate(request: NextRequest): NextResponse | null {
	const { pathname } = request.nextUrl;
	if (!pathname.startsWith("/api/teacher")) return null;
	if (!MUTATION_METHODS.has(request.method)) return null;
	if (originAllowed(request)) return null;

	return NextResponse.json(
		{ ok: false, code: "teacher_origin_mismatch", message: "Forbidden." },
		{ status: 403 },
	);
}
