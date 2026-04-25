import { timingSafeEqual } from "crypto";

import { isProductionDeployment } from "@/lib/env";

function timingSafeEqualUtf8(a: string, b: string): boolean {
	try {
		const bufA = Buffer.from(a, "utf8");
		const bufB = Buffer.from(b, "utf8");
		if (bufA.length !== bufB.length) {
			return false;
		}
		return timingSafeEqual(bufA, bufB);
	} catch {
		return false;
	}
}

function isLoopbackHost(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isLocalDevelopmentRequest(request: Request): boolean {
	if (isProductionDeployment()) return false;
	try {
		const url = new URL(request.url);
		return isLoopbackHost(url.hostname);
	} catch {
		return false;
	}
}

/**
 * Validates internal cron/worker requests.
 * - In production: `CRON_SECRET` must be set; client must send `Authorization: Bearer <secret>`.
 * - In non-production: if `CRON_SECRET` is unset:
 *   - On Vercel (`VERCEL`), only loopback is allowed (same-origin server triggers).
 *   - Off Vercel (e.g. `next dev` on a LAN address), all hosts are allowed so the
 *     post-submit grader can call `/api/internal/*` without misconfiguring `CRON_SECRET`.
 *   If a secret is set, requires a matching Bearer token everywhere.
 */
export function assertCronRequestAuthorized(request: Request): Response | null {
	const secret = process.env.CRON_SECRET?.trim() ?? "";

	if (isProductionDeployment() && !secret) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	if (!secret) {
		if (process.env.VERCEL) {
			return isLocalDevelopmentRequest(request) ?
					null
				:	Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
		}
		return null;
	}

	const auth = request.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	if (!timingSafeEqualUtf8(auth, expected)) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	return null;
}
