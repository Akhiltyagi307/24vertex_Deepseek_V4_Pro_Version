import "server-only";

import { randomUUID } from "node:crypto";

import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { clientIpFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { isAdminIpAllowed } from "@/lib/admin/ip-allowlist";
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
import {
	clearAdminLoginFailures,
	isAdminLoginBlocked,
	recordAdminLoginFailure,
} from "@/lib/admin/login-rate-limit";
import {
	getAdminJwtVersion,
	getAdminTotpFingerprint,
	setAdminTotpFingerprint,
} from "@/lib/admin/runtime-pg";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

export type AdminLoginResult =
	| { ok: true; token: string }
	| { ok: false; status: number; code: string; message: string };

/**
 * D8: All non-rate-limit, non-IP-allowlist admin-login failures return the
 * same generic message on the wire. Operator-readable detail (bcrypt cost
 * hints, dotenv-expand pitfalls, Supabase pooler hostnames) was leaking
 * deployment topology to the network response. Detail now flows only via
 * Sentry context and the `admin_action_log.payload.detail` audit field.
 */
const GENERIC_LOGIN_FAILURE_MESSAGE = "Sign-in failed";

/**
 * D3 / D13: after a successful TOTP verification, compare the live secret's
 * SHA-256 fingerprint against the one stored in `admin_runtime_kv`. On
 * mismatch (or first observation), write an audit row and update the KV
 * so operators get a clear trail when the secret rotates. Best-effort —
 * any failure here is informational and must not block login.
 */
async function trackTotpSecretRotationIfChanged(
	secret: string,
	request: NextRequest,
	ip: string,
): Promise<void> {
	try {
		const fingerprint = createHash("sha256").update(secret, "utf8").digest("hex");
		const stored = await getAdminTotpFingerprint();
		if (stored !== fingerprint) {
			if (stored) {
				await writeAdminAction({
					action: ADMIN_ACTIONS.TOTP_SECRET_ROTATED,
					payload: {
						old_fingerprint: stored,
						new_fingerprint: fingerprint,
						rotated_at: new Date().toISOString(),
					},
					ipAddress: clientIpForPostgresInet(ip),
					userAgent: request.headers.get("user-agent"),
				});
				Sentry.addBreadcrumb({
					category: "admin",
					message: "TOTP_SECRET_ROTATED",
					level: "warning",
					data: {
						old_fingerprint: stored.slice(0, 8),
						new_fingerprint: fingerprint.slice(0, 8),
					},
				});
			}
			await setAdminTotpFingerprint(fingerprint);
		}
	} catch (e) {
		Sentry.captureException(e, {
			tags: { feature: "admin", phase: "totp_fingerprint_track" },
		});
	}
}

/** Leading BOM / trailing CRLF from “copy line from .env” breaks bcrypt/plain compares unless trimmed. */
function normalizeAdminLoginEmailInput(raw: string): string {
	return raw.replace(/^\uFEFF/, "").trim();
}

/** Preserve intentional leading spaces; strip BOM + trailing whitespace editors append when copying env lines. */
function normalizeAdminLoginPasswordInput(raw: string): string {
	return raw.replace(/^\uFEFF/, "").trimEnd();
}

/** Which proxy headers were present (not values) — helps debug resolved client IP in admin login. */
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
	params: { code: string; status: number; ip: string; detail?: string },
): void {
	Sentry.withScope((scope) => {
		scope.setTag("feature", "admin");
		scope.setTag("admin_login_code", params.code);
		scope.setContext("admin_login", {
			resolved_client_ip: params.ip,
			http_status: params.status,
			node_env: process.env.NODE_ENV ?? "",
			vercel: Boolean(process.env.VERCEL),
			// D8: operator detail rides in Sentry context, not in the HTTP response.
			internal_detail: params.detail ?? null,
			...adminLoginProxyHeaderHints(request),
		});
		const level =
			params.code === "rate_limited" ? "warning"
			: params.code === "internal_error" || params.code === "db_at_capacity" ? "error"
			: "info";
		Sentry.captureMessage(`admin_login:${params.code}`, {
			level,
			fingerprint: ["admin-login", params.code],
		});
	});
}

export async function performAdminLogin(request: NextRequest, input: { email: string; password: string; totp?: string }): Promise<AdminLoginResult> {
	const emailNorm = normalizeAdminLoginEmailInput(input.email);
	const passwordNorm = normalizeAdminLoginPasswordInput(input.password);
	const totpNorm =
		typeof input.totp === "string" && input.totp.trim().length > 0 ? input.totp.trim() : undefined;

	const ip = clientIpFromRequest(request);
	const ipInet = clientIpForPostgresInet(ip);
	const ua = request.headers.get("user-agent") ?? "";

	if (!isAdminIpAllowed(ip)) {
		await recordAdminLoginFailure(ip);
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "ip_not_allowed" },
		});
		reportAdminLoginRejected(request, { code: "forbidden_ip", status: 403, ip });
		return {
			ok: false,
			status: 403,
			code: "forbidden_ip",
			message: "This network address is not allowed to sign in to admin.",
		};
	}

	if (await isAdminLoginBlocked(ip)) {
		reportAdminLoginRejected(request, { code: "rate_limited", status: 429, ip });
		return { ok: false, status: 429, code: "rate_limited", message: "Too many attempts" };
	}

	if (!verifyAdminEmail(emailNorm)) {
		const detail = "Email does not match ADMIN_EMAIL in server configuration.";
		await recordAdminLoginFailure(ip);
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "bad_email", detail },
		});
		reportAdminLoginRejected(request, { code: "bad_email", status: 401, ip, detail });
		return {
			ok: false,
			status: 401,
			code: "bad_email",
			message: GENERIC_LOGIN_FAILURE_MESSAGE,
		};
	}

	const passwordOk = await verifyAdminPassword(passwordNorm);
	if (!passwordOk) {
		const detail =
			"Password does not match server configuration. Prefer `ADMIN_PASSWORD_HASH_B64` (base64 of a bcrypt hash, cost ≥ 12 in production). Legacy `ADMIN_PASSWORD_HASH` can break when Next/dotenv-expand treats `$` specially; plain `ADMIN_PASSWORD` is for local/dev only. Restart the server after env changes.";
		await recordAdminLoginFailure(ip);
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "bad_password", detail },
		});
		reportAdminLoginRejected(request, { code: "bad_password", status: 401, ip, detail });
		return {
			ok: false,
			status: 401,
			code: "bad_password",
			message: GENERIC_LOGIN_FAILURE_MESSAGE,
		};
	}

	const totpRequired = await isAdminTotpRequired();
	const secretConfigured = Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
	const totpFailureDetail =
		"Authenticator code did not verify against ADMIN_TOTP_SECRET (wrong code or clock drift). If DB flag ADMIN_TOTP_REQUIRED is false, clear this field unless you intend to use 2FA.";
	if (totpRequired) {
		if (!totpNorm || !verifyAdminTotpIfConfigured(totpNorm)) {
			await recordAdminLoginFailure(ip);
			await writeAdminAction({
				action: "login_failed",
				ipAddress: ipInet,
				userAgent: ua,
				payload: { reason: "totp_failed", detail: totpFailureDetail },
			});
			reportAdminLoginRejected(request, {
				code: "totp_failed",
				status: 401,
				ip,
				detail: totpFailureDetail,
			});
			return {
				ok: false,
				status: 401,
				code: "unauthorized",
				message: GENERIC_LOGIN_FAILURE_MESSAGE,
			};
		}
	} else if (secretConfigured && totpNorm && !verifyAdminTotpIfConfigured(totpNorm)) {
		await recordAdminLoginFailure(ip);
		await writeAdminAction({
			action: "login_failed",
			ipAddress: ipInet,
			userAgent: ua,
			payload: { reason: "totp_failed", detail: totpFailureDetail },
		});
		reportAdminLoginRejected(request, {
			code: "totp_failed",
			status: 401,
			ip,
			detail: totpFailureDetail,
		});
		return {
			ok: false,
			status: 401,
			code: "unauthorized",
			message: GENERIC_LOGIN_FAILURE_MESSAGE,
		};
	}

	// D3 / D13: track TOTP secret rotation after a successful verification.
	// We only enter here if TOTP was actually checked (i.e., secret was set
	// and a code was supplied). Awaited so the audit row is persisted before
	// the login response is sent — but wrapped in try/catch inside the
	// helper so any failure is logged and doesn't break the login.
	if (totpNorm && secretConfigured && process.env.ADMIN_TOTP_SECRET) {
		await trackTotpSecretRotationIfChanged(
			process.env.ADMIN_TOTP_SECRET.trim(),
			request,
			ip,
		);
	}

	try {
		const jti = randomUUID();
		const jwtVersion = await getAdminJwtVersion();
		const token = await signAdminJwt({ jti, jwtVersion });

		await db.insert(adminSessions).values({
			jwtId: jti,
			ipAddress: ipInet,
			userAgent: ua || null,
			totpUsed: Boolean(totpNorm && secretConfigured),
		});

		await clearAdminLoginFailures(ip);
		await writeAdminAction({
			action: "login",
			ipAddress: ipInet,
			userAgent: ua || null,
			totpUsed: Boolean(totpNorm && secretConfigured),
			payload: {},
		});

		return { ok: true, token };
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "admin" } });
		if (isPostgresTooManyConnectionsError(e)) {
			const detail =
				"Database connection limit reached. Use Supabase's transaction pooler (host …pooler.supabase.com, port 6543) and add pgbouncer=true to DATABASE_URL, keep DATABASE_POOL_MAX=1, then restart the dev server and close other DB clients.";
			reportAdminLoginRejected(request, { code: "db_at_capacity", status: 503, ip, detail });
			return {
				ok: false,
				status: 503,
				code: "db_at_capacity",
				message: GENERIC_LOGIN_FAILURE_MESSAGE,
			};
		}
		reportAdminLoginRejected(request, {
			code: "internal_error",
			status: 500,
			ip,
			detail: e instanceof Error ? e.message : String(e),
		});
		return {
			ok: false,
			status: 500,
			code: "internal_error",
			message: GENERIC_LOGIN_FAILURE_MESSAGE,
		};
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
