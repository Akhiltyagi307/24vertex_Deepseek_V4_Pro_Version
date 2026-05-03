import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { clientIpFromRequest } from "@/lib/admin/api-request-meta";
import { clientIpForPostgresInet } from "@/lib/admin/ip-sanitize";
import { isPostgresTooManyConnectionsError } from "@/lib/db/postgres-errors";
import { writeAdminAction } from "@/lib/admin/audit";
import {
	signAdminJwt,
	verifyAdminEmail,
	verifyAdminPassword,
	verifyAdminTotpIfConfigured,
} from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { isAdminIpAllowed } from "@/lib/admin/ip-allowlist";
import {
	clearAdminLoginFailures,
	isAdminLoginBlocked,
	recordAdminLoginFailure,
} from "@/lib/admin/login-rate-limit";
import { getAdminJwtVersion } from "@/lib/admin/runtime-pg";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

export type AdminLoginResult =
	| { ok: true; token: string }
	| { ok: false; status: number; code: string; message: string };

/** Which proxy headers were present (not values) — helps debug allowlist vs missing X-Forwarded-For. */
function adminLoginProxyHeaderHints(request: NextRequest): Record<string, boolean> {
	const h = request.headers;
	return {
		has_x_forwarded_for: Boolean(h.get("x-forwarded-for")),
		has_x_real_ip: Boolean(h.get("x-real-ip")),
		has_cf_connecting_ip: Boolean(h.get("cf-connecting-ip")),
		has_x_vercel_forwarded_for: Boolean(h.get("x-vercel-forwarded-for")),
	};
}

/**
 * Emits a Sentry event for a rejected admin login (no email/password).
 * In Sentry: filter by tag `admin_login_code` or message prefix `admin_login:`.
 * DB: rows in `admin_action_log` with `action = login_failed` and `payload->reason` when audit insert succeeded.
 */
function reportAdminLoginRejected(
	request: NextRequest,
	params: { code: string; status: number; ip: string },
): void {
	Sentry.withScope((scope) => {
		scope.setTag("feature", "admin");
		scope.setTag("admin_login_code", params.code);
		scope.setContext("admin_login", {
			resolved_client_ip: params.ip,
			http_status: params.status,
			node_env: process.env.NODE_ENV ?? "",
			vercel: Boolean(process.env.VERCEL),
			...adminLoginProxyHeaderHints(request),
		});
		const level =
			params.code === "ip_not_allowed" || params.code === "rate_limited" ? "warning"
			: params.code === "internal_error" || params.code === "db_at_capacity" ? "error"
			: "info";
		Sentry.captureMessage(`admin_login:${params.code}`, {
			level,
			fingerprint: ["admin-login", params.code],
		});
	});
}

export async function performAdminLogin(request: NextRequest, input: { email: string; password: string; totp?: string }): Promise<AdminLoginResult> {
	const ip = clientIpFromRequest(request);
	const ipInet = clientIpForPostgresInet(ip);
	const ua = request.headers.get("user-agent") ?? "";

	if (!isAdminIpAllowed(ip)) {
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "ip_not_allowed" },
		});
		reportAdminLoginRejected(request, { code: "ip_not_allowed", status: 403, ip });
		return {
			ok: false,
			status: 403,
			code: "ip_not_allowed",
			message:
				"Admin sign-in is blocked: your IP is not on ADMIN_IP_ALLOWLIST, or your public IP changed (e.g. different Wi-Fi).",
		};
	}

	if (await isAdminLoginBlocked(ip)) {
		reportAdminLoginRejected(request, { code: "rate_limited", status: 429, ip });
		return { ok: false, status: 429, code: "rate_limited", message: "Too many attempts" };
	}

	if (!verifyAdminEmail(input.email)) {
		await recordAdminLoginFailure(ip);
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "bad_email" },
		});
		reportAdminLoginRejected(request, { code: "bad_email", status: 401, ip });
		return {
			ok: false,
			status: 401,
			code: "bad_email",
			message: "Email does not match ADMIN_EMAIL in server configuration.",
		};
	}

	const passwordOk = await verifyAdminPassword(input.password);
	if (!passwordOk) {
		await recordAdminLoginFailure(ip);
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "bad_password" },
		});
		reportAdminLoginRejected(request, { code: "bad_password", status: 401, ip });
		return {
			ok: false,
			status: 401,
			code: "bad_password",
			message:
				"Password does not match server configuration. Prefer `ADMIN_PASSWORD_HASH_B64` (base64 of a bcrypt hash, cost ≥ 12 in production). Legacy `ADMIN_PASSWORD_HASH` can break when Next/dotenv-expand treats `$` specially; plain `ADMIN_PASSWORD` is for local/dev only. Restart the server after env changes.",
		};
	}

	const totpRequired = await isAdminTotpRequired();
	const secretConfigured = Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
	if (totpRequired) {
		if (!input.totp?.trim() || !verifyAdminTotpIfConfigured(input.totp)) {
			await recordAdminLoginFailure(ip);
			await writeAdminAction({
				action: "login_failed",
				ipAddress: ipInet,
				userAgent: ua,
				payload: { reason: "totp_failed" },
			});
			reportAdminLoginRejected(request, { code: "totp_failed", status: 401, ip });
			return { ok: false, status: 401, code: "unauthorized", message: "Invalid credentials" };
		}
	} else if (secretConfigured && input.totp?.trim() && !verifyAdminTotpIfConfigured(input.totp)) {
		await recordAdminLoginFailure(ip);
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "totp_failed" },
		});
		reportAdminLoginRejected(request, { code: "totp_failed", status: 401, ip });
		return { ok: false, status: 401, code: "unauthorized", message: "Invalid credentials" };
	}

	try {
		const jti = randomUUID();
		const jwtVersion = await getAdminJwtVersion();
		const token = await signAdminJwt({ jti, jwtVersion });

		await db.insert(adminSessions).values({
			jwtId: jti,
			ipAddress: ipInet,
			userAgent: ua || null,
			totpUsed: Boolean(input.totp?.trim() && secretConfigured),
		});

		await clearAdminLoginFailures(ip);
		await writeAdminAction({
			action: "login",
			ipAddress: ipInet,
			userAgent: ua || null,
			totpUsed: Boolean(input.totp?.trim() && secretConfigured),
			payload: {},
		});

		return { ok: true, token };
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "admin" } });
		if (isPostgresTooManyConnectionsError(e)) {
			reportAdminLoginRejected(request, { code: "db_at_capacity", status: 503, ip });
			return {
				ok: false,
				status: 503,
				code: "db_at_capacity",
				message:
					"Database connection limit reached. Use Supabase’s transaction pooler (host …pooler.supabase.com, port 6543) and add pgbouncer=true to DATABASE_URL, keep DATABASE_POOL_MAX=1, then restart the dev server and close other DB clients.",
			};
		}
		reportAdminLoginRejected(request, { code: "internal_error", status: 500, ip });
		return { ok: false, status: 500, code: "internal_error", message: "Could not complete sign-in" };
	}
}

/**
 * `Secure` session cookies over plain HTTP are rejected by browsers and can cause Next.js to fail
 * while building the login response (surfacing as HTTP 500 with a non-JSON error page).
 * Use `secure` only when the incoming request is actually HTTPS (URL or `x-forwarded-proto`).
 */
export function shouldUseSecureAdminSessionCookie(
	request?: Pick<NextRequest, "headers" | "nextUrl">,
): boolean {
	if (process.env.NODE_ENV !== "production") return false;
	if (!request) return true;
	if (request.nextUrl.protocol === "https:") return true;
	const xfp = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
	return xfp === "https";
}

export function adminSessionCookieDescriptor(
	request?: Pick<NextRequest, "headers" | "nextUrl">,
): {
	name: string;
	options: {
		httpOnly: true;
		secure: boolean;
		sameSite: "strict";
		path: string;
		maxAge: number;
	};
} {
	const secure = shouldUseSecureAdminSessionCookie(request);
	return {
		name: ADMIN_SESSION_COOKIE,
		options: {
			httpOnly: true as const,
			secure,
			sameSite: "strict" as const,
			path: "/",
			maxAge: 8 * 60 * 60,
		},
	};
}

export async function revokeAdminSessionByJti(jti: string): Promise<void> {
	await db
		.update(adminSessions)
		.set({ revokedAt: new Date() })
		.where(eq(adminSessions.jwtId, jti));
}
