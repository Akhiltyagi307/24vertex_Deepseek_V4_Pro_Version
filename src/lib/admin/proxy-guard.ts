import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { verifyAdminJwtShape } from "@/lib/admin/jwt-edge";
import { originAllowed } from "@/lib/security/origin-guard";

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
		!originAllowed(request)
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
