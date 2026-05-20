import { generateSync } from "otplib";
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./admin-auth.helpers";

/**
 * D34: end-to-end coverage for /api/admin/panic.
 *
 *   1. Log in as admin → confirm a benign authenticated call succeeds.
 *   2. Invoke /api/admin/panic with a fresh TOTP and the static panic token,
 *      both passed via headers (D6: tokens never go in the URL).
 *   3. Repeat the benign authenticated call → expect 401 because the JWT
 *      version was bumped and (when ADMIN_JWT_SECRET_v* is configured) the
 *      kid was rotated.
 *
 * Skipped unless the operator wires up:
 *   - PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD
 *   - PLAYWRIGHT_PANIC_TOKEN  — matches server `ADMIN_PANIC_TOKEN`
 *   - PLAYWRIGHT_ADMIN_TOTP_SECRET — matches server `ADMIN_TOTP_SECRET`
 *
 * Running this spec REVOKES every active admin session against the target
 * environment — use a staging deployment.
 */

function apiBase(): string {
	const raw = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
	try {
		const u = new URL(raw);
		if (u.hostname === "localhost") u.hostname = "127.0.0.1";
		return u.origin + (u.pathname === "/" ? "" : u.pathname);
	} catch {
		return raw;
	}
}

test.describe("D34: /api/admin/panic e2e", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL ||
				!process.env.PLAYWRIGHT_ADMIN_PASSWORD ||
				!process.env.PLAYWRIGHT_PANIC_TOKEN ||
				!process.env.PLAYWRIGHT_ADMIN_TOTP_SECRET,
			"Set PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD, PLAYWRIGHT_PANIC_TOKEN, and PLAYWRIGHT_ADMIN_TOTP_SECRET — this spec revokes all admin sessions on the target environment.",
		);
	});

	test("panic with header token + TOTP revokes all admin sessions", async ({ page }) => {
		await loginAsAdmin(page);
		const base = apiBase();

		// Benign authenticated call — sanity check that the session works.
		const before = await page.request.get(`${base}/api/admin/search?q=ab`);
		expect(before.ok()).toBeTruthy();

		const totp = generateSync({
			secret: process.env.PLAYWRIGHT_ADMIN_TOTP_SECRET!,
			strategy: "totp",
		});

		const panic = await page.request.post(`${base}/api/admin/panic`, {
			headers: {
				"x-admin-panic-token": process.env.PLAYWRIGHT_PANIC_TOKEN!,
				"x-admin-panic-totp": totp,
			},
		});
		expect(panic.ok()).toBeTruthy();
		const body = (await panic.json()) as { jwt_version?: number };
		expect(typeof body.jwt_version).toBe("number");

		// All admin sessions are revoked; the same authenticated call now 401s.
		const after = await page.request.get(`${base}/api/admin/search?q=ab`);
		expect(after.status()).toBe(401);
	});

	test("panic with token but missing TOTP returns 403 (D11 step-up enforcement)", async ({ page }) => {
		const base = apiBase();
		const r = await page.request.post(`${base}/api/admin/panic`, {
			headers: {
				"x-admin-panic-token": process.env.PLAYWRIGHT_PANIC_TOKEN!,
			},
		});
		expect(r.status()).toBe(403);
	});

	test("panic with wrong token returns 403 even when TOTP is right", async ({ page }) => {
		const base = apiBase();
		const totp = generateSync({
			secret: process.env.PLAYWRIGHT_ADMIN_TOTP_SECRET!,
			strategy: "totp",
		});
		const r = await page.request.post(`${base}/api/admin/panic`, {
			headers: {
				"x-admin-panic-token": "wrong-token-of-very-different-length",
				"x-admin-panic-totp": totp,
			},
		});
		expect(r.status()).toBe(403);
	});
});
