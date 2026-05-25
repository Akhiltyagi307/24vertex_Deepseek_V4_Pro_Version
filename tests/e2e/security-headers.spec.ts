/**
 * Smoke test for the security-header bundle. Phase 4 hardens the per-route CSP
 * (proxy.ts) and the static headers in next.config.ts; this spec locks in the
 * non-negotiable minimum so a future refactor can't quietly drop them.
 *
 * Header surface:
 *   - Content-Security-Policy   : `strict-dynamic` script-src + per-request nonce.
 *                                 `img-src` allowlist (no broad `https:`).
 *     Set in proxy.ts; the static next.config.ts headers don't include it
 *     (CSP is per-request to issue a fresh nonce).
 *   - X-Frame-Options            : SAMEORIGIN
 *   - X-Content-Type-Options     : nosniff
 *   - Referrer-Policy            : strict-origin-when-cross-origin
 *   - Permissions-Policy         : camera=(), microphone=(), geolocation=(),
 *                                  payment=(self "checkout.razorpay.com"),
 *                                  interest-cohort=(), fullscreen=(self)
 *   - Cross-Origin-Opener-Policy : same-origin
 *   - Cross-Origin-Resource-Policy : same-origin
 *   - X-Robots-Tag               : noindex,nofollow on /admin and /api/admin only
 */
import { test, expect } from "@playwright/test";

const BASE_HEADERS_REQUIRED = [
	["x-content-type-options", /^nosniff$/i],
	["referrer-policy", /^strict-origin-when-cross-origin$/i],
	["x-frame-options", /^SAMEORIGIN$/i],
	["permissions-policy", /camera=\(\)/i],
	["permissions-policy", /interest-cohort=\(\)/i],
	["permissions-policy", /payment=\(self "https:\/\/checkout\.razorpay\.com"\)/i],
	["cross-origin-opener-policy", /^same-origin$/i],
	["cross-origin-resource-policy", /^same-origin$/i],
] as const;

test.describe("security headers", () => {
	test("marketing landing carries the base header bundle", async ({ request }) => {
		const res = await request.get("/", { failOnStatusCode: false });
		const headers = res.headers();
		for (const [name, pattern] of BASE_HEADERS_REQUIRED) {
			expect(headers[name], `header \`${name}\` missing`).toMatch(pattern);
		}
	});

	test("marketing landing uses public CSP without a per-request nonce", async ({ request }) => {
		const res = await request.get("/", { failOnStatusCode: false });
		const csp = res.headers()["content-security-policy"];
		expect(csp, "Content-Security-Policy header missing").toBeTruthy();
		expect(csp).toMatch(/strict-dynamic/);
		expect(csp).not.toMatch(/'nonce-[A-Za-z0-9+/=_-]+'/);
	});

	test("login page carries CSP with strict-dynamic and a nonce", async ({ request }) => {
		const res = await request.get("/login", { failOnStatusCode: false });
		const headers = res.headers();
		const csp = headers["content-security-policy"];
		expect(csp, "Content-Security-Policy header missing").toBeTruthy();
		expect(csp).toMatch(/strict-dynamic/);
		expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=_-]+'/);
	});

	test("admin routes additionally carry X-Robots-Tag noindex", async ({ request }) => {
		const res = await request.get("/admin/login", { failOnStatusCode: false });
		const headers = res.headers();
		expect(headers["x-robots-tag"], "X-Robots-Tag missing on /admin").toMatch(/noindex/i);
		// Base bundle must still be present.
		for (const [name, pattern] of BASE_HEADERS_REQUIRED) {
			expect(headers[name], `header \`${name}\` missing on /admin/login`).toMatch(pattern);
		}
	});
});
