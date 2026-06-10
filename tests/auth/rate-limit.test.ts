import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * M3: app-level rate limiting for the Supabase user-auth surfaces. We mock the
 * underlying limiter so the wrapper's policy (allow / deny-when-limited /
 * fail-closed-when-degraded) is asserted in isolation.
 */

const rlConsume = vi.fn();
const shouldDenyOnDegraded = vi.fn(() => false);

vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume }));
vi.mock("@/lib/ratelimit/fail-policy", () => ({ shouldDenyOnDegraded }));

function res(over: Partial<{ allowed: boolean; degraded: string }> = {}) {
	return { allowed: true, remaining: 5, resetAt: new Date(Date.now() + 60_000), ...over };
}

describe("auth rate limiting (M3)", () => {
	afterEach(() => {
		vi.clearAllMocks();
		shouldDenyOnDegraded.mockReturnValue(false);
	});

	it("login allows when under the limit", async () => {
		rlConsume.mockResolvedValue(res());
		const { consumeAuthLogin } = await import("@/lib/auth/rate-limit");
		expect(await consumeAuthLogin("1.2.3.4", "a@b.com")).toEqual({ ok: true });
	});

	it("login denies when the per-account bucket is exhausted", async () => {
		rlConsume.mockResolvedValueOnce(res({ allowed: false }));
		const { consumeAuthLogin } = await import("@/lib/auth/rate-limit");
		const r = await consumeAuthLogin("1.2.3.4", "a@b.com");
		expect(r.ok).toBe(false);
	});

	it("password reset fails closed when the limiter is degraded even though allowed", async () => {
		rlConsume.mockResolvedValue(res({ degraded: "circuit_open" }));
		shouldDenyOnDegraded.mockReturnValue(true);
		const { consumeAuthPasswordReset } = await import("@/lib/auth/rate-limit");
		const r = await consumeAuthPasswordReset("1.2.3.4", "a@b.com");
		expect(r.ok).toBe(false);
	});

	it("signup denies when the limiter is degraded", async () => {
		rlConsume.mockResolvedValue(res({ degraded: "circuit_fail_closed" }));
		shouldDenyOnDegraded.mockReturnValue(true);
		const { consumeAuthSignup } = await import("@/lib/auth/rate-limit");
		expect((await consumeAuthSignup("9.9.9.9")).ok).toBe(false);
	});

	it("tolerates a null IP (shared/unknown) without throwing", async () => {
		rlConsume.mockResolvedValue(res());
		const { consumeAuthSignup } = await import("@/lib/auth/rate-limit");
		expect(await consumeAuthSignup(null)).toEqual({ ok: true });
	});
});
