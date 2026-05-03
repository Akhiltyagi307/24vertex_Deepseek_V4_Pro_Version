import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_RUNTIME_KV_JWT_VERSION } from "@/lib/admin/constants";
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
 * Read JWT version from Supabase PostgREST (Edge-safe fetch; no Node postgres driver).
 * Returns 0 if env missing or request fails (fail-open for availability; Node routes still verify).
 */
async function getJwtVersionFromSupabaseRest(): Promise<number> {
	const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
	const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!base || !service) return 0;
	try {
		const u = new URL(`${base}/rest/v1/admin_runtime_kv`);
		u.searchParams.set("key", `eq.${ADMIN_RUNTIME_KV_JWT_VERSION}`);
		u.searchParams.set("select", "value_int");
		const res = await fetch(u.toString(), {
			headers: {
				apikey: service,
				Authorization: `Bearer ${service}`,
				Accept: "application/json",
			},
			cache: "no-store",
		});
		if (!res.ok) return 0;
		const body = (await res.json()) as unknown;
		const row = Array.isArray(body) ? body[0] : body;
		const v =
			row && typeof row === "object" && row !== null && "value_int" in row ?
				(row as { value_int: unknown }).value_int
			:	0;
		return typeof v === "number" ? v : Number(v) || 0;
	} catch {
		return 0;
	}
}

/**
 * Returns a redirect/401 response when the admin session is missing or invalid; otherwise null.
 * Caller should still run `updateSession` when returning null.
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

	const current = await getJwtVersionFromSupabaseRest();
	if (shape.v < current) {
		if (pathname.startsWith("/api/admin")) {
			return NextResponse.json({ error: "Unauthorized", code: "admin_token_revoked" }, { status: 401 });
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
