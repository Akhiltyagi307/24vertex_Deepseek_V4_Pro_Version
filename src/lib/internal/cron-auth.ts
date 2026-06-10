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
 * - In production deployment: `CRON_SECRET` must be set; client must send `Authorization: Bearer <secret>`.
 * - If `CRON_SECRET` is unset: only allowed when `ALLOW_UNAUTHENTICATED_CRON_DEV=1`,
 *   `NODE_ENV === "development"`, and the request URL host is loopback (`localhost`,
 *   `127.0.0.1`, `::1`). LAN or hosted URLs must set `CRON_SECRET` and use Bearer
 *   (see `triggerWorkerInBackground`).
 * - If `CRON_SECRET` is set: requires a matching Bearer token on every host.
 */
export function assertCronRequestAuthorized(request: Request): Response | null {
	const secret = process.env.CRON_SECRET?.trim() ?? "";

	if (isProductionDeployment() && !secret) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	if (!secret) {
		// Dev-only bypass for local loopback runs without a CRON_SECRET, gated
		// behind an explicit opt-in flag. Without the flag, a self-host left in
		// dev mode behind a host-rewriting reverse proxy can't reach the internal
		// jobs unauthenticated.
		if (
			process.env.ALLOW_UNAUTHENTICATED_CRON_DEV === "1" &&
			process.env.NODE_ENV === "development" &&
			isLocalDevelopmentRequest(request)
		) {
			return null;
		}
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const auth = request.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	if (!timingSafeEqualUtf8(auth, expected)) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	return null;
}
