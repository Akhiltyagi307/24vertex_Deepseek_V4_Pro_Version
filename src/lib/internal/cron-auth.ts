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
 * - In non-production: if `CRON_SECRET` is unset, allows requests (local dev). If set, requires a matching Bearer token.
 */
export function assertCronRequestAuthorized(request: Request): Response | null {
	const secret = process.env.CRON_SECRET?.trim() ?? "";

	if (isProductionDeployment() && !secret) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	if (!secret) {
		return isLocalDevelopmentRequest(request) ?
				null
			:	Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const auth = request.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	if (!timingSafeEqualUtf8(auth, expected)) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	return null;
}
