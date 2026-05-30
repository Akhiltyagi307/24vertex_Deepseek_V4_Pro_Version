/**
 * Route-level CRON_SECRET gate coverage for the money-affecting internal
 * billing crons (H-4). These had zero executing route tests — only the shared
 * `assertCronRequestAuthorized` helper was unit-tested in isolation, so a route
 * that forgot to call it (or called it after doing work) would ship green.
 *
 * Each test exercises the real handler with no / wrong bearer and asserts 401
 * BEFORE any business logic runs (so no DB/Razorpay/email mocking is needed).
 * The "valid bearer dispatches" path is intentionally out of scope here — it
 * requires per-route dependency mocking; the gate is the security-critical bit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as expireCouponSubscriptions } from "@/app/api/internal/billing/expire-coupon-subscriptions/route";
import { POST as expireCoupons } from "@/app/api/internal/billing/expire-coupons/route";
import { POST as pauseAutoCancel } from "@/app/api/internal/billing/pause-auto-cancel/route";
import { POST as reconcile } from "@/app/api/internal/billing/reconcile/route";
import { POST as runDunning } from "@/app/api/internal/billing/run-dunning/route";
import { POST as trialEmails } from "@/app/api/internal/billing/trial-emails/route";
import { POST as validateRazorpayOffers } from "@/app/api/internal/billing/validate-razorpay-offers/route";

const ROUTES: Array<{ name: string; handler: (req: Request) => Promise<Response> }> = [
	{ name: "run-dunning", handler: runDunning },
	{ name: "reconcile", handler: reconcile },
	{ name: "expire-coupons", handler: expireCoupons },
	{ name: "expire-coupon-subscriptions", handler: expireCouponSubscriptions },
	{ name: "pause-auto-cancel", handler: pauseAutoCancel },
	{ name: "trial-emails", handler: trialEmails },
	{ name: "validate-razorpay-offers", handler: validateRazorpayOffers },
];

function makeRequest(bearer?: string): Request {
	const headers: Record<string, string> = {};
	if (bearer) headers.authorization = `Bearer ${bearer}`;
	return new Request("http://localhost/api/internal/billing/cron", { method: "POST", headers });
}

describe("internal billing crons — CRON_SECRET gate (H-4)", () => {
	beforeEach(() => {
		// A secret IS configured; the gate must still reject missing/wrong tokens.
		vi.stubEnv("CRON_SECRET", "unit-test-cron-secret");
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	for (const { name, handler } of ROUTES) {
		it(`${name}: rejects a request with no bearer token (401)`, async () => {
			const res = await handler(makeRequest());
			expect(res.status).toBe(401);
		});

		it(`${name}: rejects a request with a wrong bearer token (401)`, async () => {
			const res = await handler(makeRequest("not-the-secret"));
			expect(res.status).toBe(401);
		});
	}
});
