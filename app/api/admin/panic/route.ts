import { timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { clientIpFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { chooseNextAdminJwtKid, consumeAdminTotp } from "@/lib/admin/auth";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import {
	bumpAdminJwtVersion,
	getAdminJwtKid,
	setAdminJwtKid,
} from "@/lib/admin/runtime-pg";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";
import { getAdminNotificationRecipients } from "@/lib/env";
import { rateLimitedResponse, rlConsume } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** D6 per-IP rate limit envelope for /api/admin/panic. */
const PANIC_RATE_LIMIT_MAX = 5;
const PANIC_RATE_LIMIT_WINDOW_SEC = 600; // 10 minutes

/**
 * Reads the admin panic token from a request header — never the URL query —
 * because URL parameters are written to Vercel/edge access logs and would
 * otherwise leak the secret. Accepts either:
 *
 *   Authorization: Bearer <token>
 *   X-Admin-Panic-Token: <token>
 */
function readPanicTokenFromHeaders(request: NextRequest): string | null {
	const auth = request.headers.get("authorization");
	if (auth) {
		const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
		if (match) return match[1].trim();
	}
	const direct = request.headers.get("x-admin-panic-token");
	if (direct) return direct.trim();
	return null;
}

/**
 * D11 step-up TOTP. Read from a header so both GET and POST invocations
 * keep working (operator runs panic via curl). The body of GET requests
 * is unreliable; a header is the lowest-friction surface.
 */
function readPanicTotpFromHeaders(request: NextRequest): string | null {
	const totp = request.headers.get("x-admin-panic-totp");
	if (totp && totp.trim().length > 0) return totp.trim();
	return null;
}

/** Constant-time string compare. Length mismatch returns false up front. */
function timingSafeStringEqual(a: string, b: string): boolean {
	const aBuf = Buffer.from(a, "utf8");
	const bBuf = Buffer.from(b, "utf8");
	if (aBuf.length !== bBuf.length) return false;
	return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest) {
	return handlePanic(request);
}

// GET kept for browser-based emergency invocation. Token + TOTP both come
// from headers; supply via curl `-H` or the equivalent admin tool.
export async function GET(request: NextRequest) {
	return handlePanic(request);
}

async function handlePanic(request: NextRequest): Promise<NextResponse> {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		scope.setTag("admin_action", "panic");

		// D6: per-IP rate limit BEFORE token compare so a brute-forcer can't
		// hammer the token surface without paying a cost. 5 attempts per 10
		// minutes is operator-friendly (genuine panic invocations are rare)
		// and tight enough to make online guessing infeasible.
		const ip = clientIpFromRequest(request);
		const rl = await rlConsume({
			key: `admin-panic:ip:${ip}`,
			limit: PANIC_RATE_LIMIT_MAX,
			windowSec: PANIC_RATE_LIMIT_WINDOW_SEC,
		});
		if (!rl.allowed) {
			return rateLimitedResponse(rl, PANIC_RATE_LIMIT_MAX, {
				message: "Too many panic attempts. Try again later.",
			});
		}

		const token = readPanicTokenFromHeaders(request);
		const expected = process.env.ADMIN_PANIC_TOKEN?.trim();
		if (!expected || !token || !timingSafeStringEqual(token, expected)) {
			return adminErrorResponse("Forbidden", { status: 403, code: "forbidden" });
		}

		// D11: step-up TOTP. Panic is the highest-blast-radius operator action
		// in the system; requiring a fresh authenticator code adds an out-of-
		// band proof on top of the static panic token (which could be exfil-
		// trated from server env or a backup).
		const totpSecret = process.env.ADMIN_TOTP_SECRET?.trim();
		if (!totpSecret) {
			Sentry.captureMessage("admin_panic_missing_totp_secret", {
				level: "error",
				fingerprint: ["admin-panic", "missing-totp-secret"],
			});
			return adminErrorResponse(
				"ADMIN_TOTP_SECRET must be configured before panic can run",
				{ status: 403, code: "forbidden" },
			);
		}
		const totp = readPanicTotpFromHeaders(request);
		if (!totp || !(await consumeAdminTotp(totp))) {
			return adminErrorResponse("Forbidden", { status: 403, code: "forbidden" });
		}

		const v = await bumpAdminJwtVersion();

		// D4 / D12: rotate the JWT signing kid if a fresh ADMIN_JWT_SECRET_v* is
		// configured. Even with the version bump, rotating the underlying key
		// material is the lever that protects the edge surface if the previous
		// key leaked. If no fresh secret is available we log a Sentry warning
		// and proceed (the version bump alone still invalidates).
		const previousKid = await getAdminJwtKid();
		const nextKid = chooseNextAdminJwtKid(previousKid);
		if (nextKid) {
			try {
				await setAdminJwtKid(nextKid);
				await writeAdminAction({
					action: ADMIN_ACTIONS.JWT_KID_ROTATED,
					payload: { from: previousKid, to: nextKid, jwt_version: v },
					ipAddress: ip,
					userAgent: request.headers.get("user-agent"),
					totpUsed: true,
				});
			} catch (e) {
				Sentry.captureException(e, {
					tags: { feature: "admin", phase: "panic_kid_rotation" },
				});
			}
		} else {
			Sentry.captureMessage("admin_panic_no_fresh_kid_available", {
				level: "warning",
				fingerprint: ["admin-panic", "no-fresh-kid"],
				tags: { feature: "admin" },
			});
		}

		// Strict audit: panic revokes EVERY admin session and is the
		// highest-stakes operator action in the system. A missing audit row
		// here is unacceptable.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.PANIC_REVOKE_ALL,
			payload: { jwt_version: v, from_kid: previousKid, to_kid: nextKid },
			ipAddress: ip,
			userAgent: request.headers.get("user-agent"),
			totpUsed: true,
		});

		const recipients = getAdminNotificationRecipients();
		await Promise.allSettled(
			recipients.map(async (to) => {
				try {
					await sendHtmlEmailLogged({
						to,
						subject: "24Vertex admin panic: all sessions invalidated",
						html: `<p>All admin JWTs were invalidated (version ${v}).</p>`,
						templateSlug: "admin-panic",
						templateVariables: { jwt_version: String(v) },
					});
				} catch (e) {
					Sentry.captureException(e);
				}
			}),
		);

		return adminAckResponse({ jwt_version: v });
	});
}
