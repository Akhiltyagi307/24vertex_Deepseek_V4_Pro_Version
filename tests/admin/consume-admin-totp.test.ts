import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * M2: `consumeAdminTotp` composes TOTP verification with single-use enforcement.
 * `verifyTotp` and the KV step-consume are mocked so each branch is deterministic.
 */

const verifyTotp = vi.fn();
const tryConsumeAdminTotpStep = vi.fn();

vi.mock("@/lib/admin/totp", () => ({ verifyTotp }));
vi.mock("@/lib/admin/runtime-pg", () => ({
	tryConsumeAdminTotpStep,
	getAdminJwtKid: vi.fn(async () => null),
	getAdminJwtVersion: vi.fn(async () => 0),
}));

describe("consumeAdminTotp (M2)", () => {
	afterEach(() => {
		vi.clearAllMocks();
		delete process.env.ADMIN_TOTP_SECRET;
	});

	it("returns true without consuming a step when no secret is configured", async () => {
		delete process.env.ADMIN_TOTP_SECRET;
		const { consumeAdminTotp } = await import("@/lib/admin/auth");
		expect(await consumeAdminTotp("123456")).toBe(true);
		expect(tryConsumeAdminTotpStep).not.toHaveBeenCalled();
	});

	it("rejects an invalid code and never consumes a step", async () => {
		process.env.ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
		verifyTotp.mockReturnValue(false);
		const { consumeAdminTotp } = await import("@/lib/admin/auth");
		expect(await consumeAdminTotp("000000")).toBe(false);
		expect(tryConsumeAdminTotpStep).not.toHaveBeenCalled();
	});

	it("consumes the step for a valid code and rejects a replay of the same step", async () => {
		process.env.ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
		verifyTotp.mockReturnValue(true);
		tryConsumeAdminTotpStep.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		const { consumeAdminTotp } = await import("@/lib/admin/auth");
		expect(await consumeAdminTotp("111111")).toBe(true);
		expect(await consumeAdminTotp("111111")).toBe(false);
		expect(tryConsumeAdminTotpStep).toHaveBeenCalledTimes(2);
	});
});
