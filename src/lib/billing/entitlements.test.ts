import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildEntitlementSnapshot } from "@/lib/billing/entitlements";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("buildEntitlementSnapshot policy", () => {
	it("allows trial usage while quotas remain", () => {
		vi.stubEnv("SAAS_ENFORCEMENT", "true");
		const snapshot = buildEntitlementSnapshot({
			profileId: "p1",
			planCode: "free",
			status: "trialing",
			staffOverride: false,
			trialEndsAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
			currentPeriodStart: new Date(Date.now() - 3600 * 1000).toISOString(),
			currentPeriodEnd: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
			cancelAtPeriodEnd: false,
			testsQuota: 5,
			testsUsed: 0,
			tokensQuota: 50_000,
			tokensUsed: 0,
		});
		expect(snapshot.reason).toBe("ok");
		expect(snapshot.canStartTest).toBe(true);
		expect(snapshot.canChatDoubt).toBe(true);
	});

	it("degrades access when test quota is exhausted", () => {
		vi.stubEnv("SAAS_ENFORCEMENT", "true");
		const snapshot = buildEntitlementSnapshot({
			profileId: "p2",
			planCode: "free",
			status: "trialing",
			staffOverride: false,
			trialEndsAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
			currentPeriodStart: new Date(Date.now() - 3600 * 1000).toISOString(),
			currentPeriodEnd: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
			cancelAtPeriodEnd: false,
			testsQuota: 5,
			testsUsed: 5,
			tokensQuota: 50_000,
			tokensUsed: 1_000,
		});
		expect(snapshot.reason).toBe("quota_tests");
		expect(snapshot.canStartTest).toBe(false);
		expect(snapshot.canChatDoubt).toBe(true);
	});

	it("blocks both tests and doubt chat when trial expires", () => {
		vi.stubEnv("SAAS_ENFORCEMENT", "true");
		const snapshot = buildEntitlementSnapshot({
			profileId: "p3",
			planCode: "free",
			status: "trialing",
			staffOverride: false,
			trialEndsAt: new Date(Date.now() - 60_000).toISOString(),
			currentPeriodStart: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
			currentPeriodEnd: new Date(Date.now() + 60_000).toISOString(),
			cancelAtPeriodEnd: false,
			testsQuota: 5,
			testsUsed: 1,
			tokensQuota: 50_000,
			tokensUsed: 1_000,
		});
		expect(snapshot.reason).toBe("trial_expired");
		expect(snapshot.canStartTest).toBe(false);
		expect(snapshot.canChatDoubt).toBe(false);
	});
});
