import { afterEach, describe, expect, it } from "vitest";

import { buildPublicMarketingCsp, resolveCspPolicyForPath } from "@/lib/security/csp";

// Newer @types/node declares `NODE_ENV` as a read-only string union (development | production | test),
// so direct property assignment trips TS2540. Use a runtime-only `Reflect.set` wrapper to bypass the
// type-level immutability — the underlying `process.env` object is still a plain mutable record at
// runtime, and resetting via the same wrapper in `afterEach` keeps test isolation intact.
const setNodeEnv = (value: string | undefined): void => {
	Reflect.set(process.env, "NODE_ENV", value);
};

describe("buildPublicMarketingCsp", () => {
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		setNodeEnv(originalNodeEnv);
	});

	it("omits build-time hashes in development so unsafe-inline can allow next-themes", () => {
		setNodeEnv("development");
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
