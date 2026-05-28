import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPublicMarketingCsp, resolveCspPolicyForPath } from "@/lib/security/csp";

describe("buildPublicMarketingCsp", () => {
	afterEach(() => {
		// `vi.unstubAllEnvs` restores process.env to its state at module load,
		// which is what we want after each NODE_ENV override. Using vi helpers
		// rather than direct `process.env.NODE_ENV = ...` because Node 22's
		// types declare NODE_ENV as read-only.
		vi.unstubAllEnvs();
	});

	it("omits build-time hashes in development so unsafe-inline can allow next-themes", () => {
		vi.stubEnv("NODE_ENV", "development");
		const csp = buildPublicMarketingCsp();
		expect(csp).toMatch(/'unsafe-inline'/);
		expect(csp).not.toMatch(/'sha256-/);
	});
});

describe("resolveCspPolicyForPath", () => {
	it("uses nonce CSP for dynamic home and hash CSP for static marketing", () => {
		const home = resolveCspPolicyForPath("/");
		expect(home.mode).toBe("public-home");
		expect(home.forwardNonce).toBe(true);
		expect(home.csp).toMatch(/'nonce-/);
		expect(home.csp).not.toMatch(/'sha256-8\+PZF4/);

		const pricing = resolveCspPolicyForPath("/pricing");
		expect(pricing.mode).toBe("public-static");
		expect(pricing.forwardNonce).toBe(false);
		expect(pricing.csp).not.toMatch(/'nonce-/);

		const login = resolveCspPolicyForPath("/login");
		expect(login.mode).toBe("portal");
		expect(login.forwardNonce).toBe(true);
	});
});
