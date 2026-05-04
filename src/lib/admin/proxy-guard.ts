import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { verifyAdminJwtShape } from "@/lib/admin/jwt-edge";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isAdminArea(pathname: string): boolean {
	return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isPublicAdminPath(pathname: string): boolean {
	if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return true;
	if (pathname === "/api/admin/auth/login") return true;
	if (pathname === "/api/admin/panic") return true;
	return false;
}

/**
 * Defense-in-depth CSRF check for /api/admin/* mutations. Browsers always set
 * Origin on cross-origin POST/PUT/PATCH/DELETE; if it's set and doesn't match
 * our app's origin, the request is a CSRF attempt and we reject. If Origin is
 * absent (server-to-server fetch, curl, dev tools), we allow — CSRF only
 * applies to browser-driven cross-origin smuggling.
 *
 * The admin session cookie is already SameSite=Strict, so this is belt + suspenders:
 * if a future browser bug or downgrade ever weakens SameSite, we still hold.
 */
function adminOriginAllowed(request: NextRequest): boolean {
	const origin = request.headers.get("origin")?.trim();
	if (!origin) return true;

	const expected = process.env.NEXT_PUBLIC_APP_URL?.trim();
	const expectedOrigin = (() => {
		if (!expected) return null;
		try {
			return new URL(expected).origin;
		} catch {
			return null;
		}
	})();

	if (expectedOrigin && origin === expectedOrigin) return true;

	// Same-origin to the request itself is also acceptable (covers preview
	// deployments, custom domains, and the case where NEXT_PUBLIC_APP_URL is
	// unset in dev).
	try {
		const requestOrigin = new URL(request.url).origin;
		if (origin === requestOrigin) return true;
	} catch {
		/* malformed url — fall through to deny */
	}

	return false;
}

/**
 * Returns a redirect/401 response when the admin session cookie is missing or its JWT signature
 * is invalid. Otherwise returns null and the caller continues the chain.
 *
 * Panic-revoke (`v < current` check) is enforced by Node-runtime guards `requireAdmin` and
 * `requireAdminApi`, which call `verifyAdminJwt` and read the current version from postgres.
 * The root proxy deliberately does NOT fetch the version: doing so would require
 * `SUPABASE_SERVICE_ROLE_KEY` on every request through `proxy.ts`, expanding the blast radius if
 * the request handler is ever compromised. Locally-verifiable signature is enough at this layer.
 */
export async function adminProxyGate(request: NextRequest): Promise<NextResponse | null> {
	const { pathname } = request.nextUrl;
	if (!isAdminArea(pathname)) return null;

	// CSRF defense-in-depth for /api/admin/* mutations. Reject before the auth
	// check so a misconfigured Origin can never accidentally bypass into the
	// session lookup or downstream handler.
	if (
		pathname.startsWith("/api/admin") &&
		MUTATION_METHODS.has(request.method) &&
		!isPublicAdminPath(pathname) &&
		!adminOriginAllowed(request)
	) {
		return NextResponse.json(
			{ error: "Forbidden", code: "admin_origin_mismatch" },
			{ status: 403 },
		);
	}

	if (isPublicAdminPath(pathname)) return null;

	const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
	if (!token) {
		if (pathname.startsWith("/api/admin")) {
			return NextResponse.json({ error: "Unauthorized", code: "admin_unauthorized" }, { status: 401 });
		}
		const url = request.nextUrl.clone();
		url.pathname = "/admin/login";
		url.searchParams.set("next", pathname);
		return NextResponse.redirect(url);
	}

	const shape = await verifyAdminJwtShape(token);
	if (!shape) {
		if (pathname.startsWith("/api/admin")) {
			return NextResponse.json({ error: "Unauthorized", code: "admin_invalid_token" }, { status: 401 });
		}
		const url = request.nextUrl.clone();
		url.pathname = "/admin/login";
		return NextResponse.redirect(url);
	}

	return null;
}

export function isAdminAreaPath(pathname: string): boolean {
	return isAdminArea(pathname);
}

export function isPublicAdminPathname(pathname: string): boolean {
	return isPublicAdminPath(pathname);
}
