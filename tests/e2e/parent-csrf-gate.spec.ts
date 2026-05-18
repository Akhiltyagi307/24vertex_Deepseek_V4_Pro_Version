/**
 * End-to-end smoke for the parent CSRF gate added in proxy.ts (audit D2).
 *
 * Asserts that /api/parent/notifications/read-all behaves correctly when hit
 * by a cross-origin POST: the gate fires BEFORE the route's auth check and
 * returns 403 with `code: "parent_origin_mismatch"`. Same path with no Origin
 * header (server-to-server) passes the gate and falls through to the route's
 * own 401 auth response, proving the gate is order-correct.
 *
 * Auth not needed — these probes never get past the gate / 401 boundary.
 */
import { expect, test } from "@playwright/test";

test.describe("parent CSRF gate (proxy.ts)", () => {
	test("foreign Origin on a mutating /api/parent/* route is rejected with 403 parent_origin_mismatch", async ({
		request,
	}) => {
		const res = await request.post("/api/parent/notifications/read-all", {
			headers: { origin: "https://evil.example" },
			failOnStatusCode: false,
		});
		expect(res.status(), "foreign Origin must be rejected by parentProxyGate").toBe(403);
		const body = await res.json();
		expect(body).toMatchObject({ code: "parent_origin_mismatch" });
	});

	test("missing Origin header passes the gate and falls through to the route's 401", async ({
		request,
	}) => {
		const res = await request.post("/api/parent/notifications/read-all", {
			failOnStatusCode: false,
		});
		// 401 = the route's own auth check fired (no session). NOT 403 — the
		// gate must allow Origin-less server-to-server style requests through.
		expect(res.status(), "no Origin header should pass the gate; route returns 401 for missing auth").toBe(
			401,
		);
	});

	test("GET (non-mutating) is not gated", async ({ request }) => {
		const res = await request.get("/api/parent/notifications", {
			headers: { origin: "https://evil.example" },
			failOnStatusCode: false,
		});
		// GETs to /api/parent/* are exempt from the gate; 401 from route auth check.
		expect(res.status()).toBe(401);
	});
});
