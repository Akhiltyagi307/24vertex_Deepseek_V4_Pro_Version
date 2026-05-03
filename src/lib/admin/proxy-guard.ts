import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_RUNTIME_KV_JWT_VERSION } from "@/lib/admin/constants";
import { verifyAdminJwtShape } from "@/lib/admin/jwt-edge";

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
