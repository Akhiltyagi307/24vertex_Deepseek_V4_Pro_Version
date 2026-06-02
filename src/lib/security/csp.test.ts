import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCsp, buildPublicMarketingCsp, resolveCspPolicyForPath } from "@/lib/security/csp";

function scriptSrcOf(csp: string): string {
	return csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
}

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

describe("unsafe-inline drop (PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK)", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("keeps 'unsafe-inline' in script-src by default in production (legacy fallback)", () => {
		vi.stubEnv("VERCEL_ENV", "production");
		vi.stubEnv("PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK", "");
		expect(scriptSrcOf(buildCsp("test-nonce"))).toMatch(/'unsafe-inline'/);
	});

	it("drops 'unsafe-inline' from portal script-src when the prod flag is set (nonce + strict-dynamic remain)", () => {
		vi.stubEnv("VERCEL_ENV", "production");
		vi.stubEnv("PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK", "1");
		const scriptSrc = scriptSrcOf(buildCsp("test-nonce"));
		expect(scriptSrc).not.toMatch(/'unsafe-inline'/);
		expect(scriptSrc).toMatch(/'strict-dynamic'/);
		expect(scriptSrc).toMatch(/'nonce-test-nonce'/);
	});

	it("drops 'unsafe-inline' from static marketing script-src (relying on hashes) when the prod flag is set", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("VERCEL_ENV", "production");
		vi.stubEnv("PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK", "1");
		const scriptSrc = scriptSrcOf(buildPublicMarketingCsp());
		expect(scriptSrc).not.toMatch(/'unsafe-inline'/);
		expect(scriptSrc).toMatch(/'sha256-/);
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
