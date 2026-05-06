import { describe, expect, it } from "vitest";

import {
	assertTransition,
	canTransition,
	InvalidStateTransitionError,
	isSubscriptionStatus,
	isTerminalStatus,
} from "../subscription-state-machine";

describe("subscription-state-machine", () => {
	describe("isSubscriptionStatus", () => {
		it("recognises canonical statuses", () => {
			for (const s of [
				"trialing",
				"coupon",
				"active",
				"grace",
				"past_due",
				"cancelled",
				"expired",
				"paused",
			]) {
				expect(isSubscriptionStatus(s)).toBe(true);
			}
		});

		it("rejects unknown / non-string values", () => {
			expect(isSubscriptionStatus("foo")).toBe(false);
			expect(isSubscriptionStatus(null)).toBe(false);
			expect(isSubscriptionStatus(undefined)).toBe(false);
			expect(isSubscriptionStatus(42)).toBe(false);
		});
	});

	describe("canTransition (allowed)", () => {
		// Self-transitions must always be allowed: webhook replays land on
		// the same status frequently.
		it.each([
			"trialing",
			"coupon",
			"active",
			"grace",
			"past_due",
			"paused",
			"cancelled",
			"expired",
		] as const)("self-transition: %s → %s", (s) => {
			expect(canTransition(s, s)).toBe(true);
		});

		it("trialing → active (mandate authenticated, charged)", () => {
			expect(canTransition("trialing", "active")).toBe(true);
		});

		it("active → grace / past_due / cancelled / expired / paused", () => {
			expect(canTransition("active", "grace")).toBe(true);
			expect(canTransition("active", "past_due")).toBe(true);
			expect(canTransition("active", "cancelled")).toBe(true);
			expect(canTransition("active", "expired")).toBe(true);
			expect(canTransition("active", "paused")).toBe(true);
		});

		it("past_due → active (recovery)", () => {
			expect(canTransition("past_due", "active")).toBe(true);
		});

		it("grace → active (recovery)", () => {
			expect(canTransition("grace", "active")).toBe(true);
		});

		it("paused → active (resume)", () => {
			expect(canTransition("paused", "active")).toBe(true);
		});
	});

	describe("canTransition (forbidden)", () => {
		it("terminal cancelled → anything (except itself)", () => {
			expect(canTransition("cancelled", "active")).toBe(false);
			expect(canTransition("cancelled", "trialing")).toBe(false);
			expect(canTransition("cancelled", "grace")).toBe(false);
			expect(canTransition("cancelled", "expired")).toBe(false);
		});

		it("terminal expired → anything (except itself)", () => {
			expect(canTransition("expired", "active")).toBe(false);
			expect(canTransition("expired", "grace")).toBe(false);
			expect(canTransition("expired", "trialing")).toBe(false);
		});

		it("coupon → grace / past_due (no payment failures on a free comp)", () => {
			expect(canTransition("coupon", "grace")).toBe(false);
			expect(canTransition("coupon", "past_due")).toBe(false);
			expect(canTransition("coupon", "paused")).toBe(false);
		});

		it("active → trialing / coupon (cannot regress)", () => {
			expect(canTransition("active", "trialing")).toBe(false);
			expect(canTransition("active", "coupon")).toBe(false);
		});
	});

	describe("isTerminalStatus", () => {
		it("cancelled and expired are terminal", () => {
			expect(isTerminalStatus("cancelled")).toBe(true);
			expect(isTerminalStatus("expired")).toBe(true);
		});

		it("active and trialing are not terminal", () => {
			expect(isTerminalStatus("active")).toBe(false);
			expect(isTerminalStatus("trialing")).toBe(false);
			expect(isTerminalStatus("paused")).toBe(false);
		});
	});

	describe("assertTransition", () => {
		it("returns void for valid transitions", () => {
			expect(() => assertTransition("active", "cancelled", "sub_123")).not.toThrow();
		});

		it("throws InvalidStateTransitionError on forbidden transitions with subscription id in error", () => {
			let caught: unknown;
			try {
				assertTransition("cancelled", "active", "sub_xyz");
			} catch (e) {
				caught = e;
			}
			expect(caught).toBeInstanceOf(InvalidStateTransitionError);
			const err = caught as InvalidStateTransitionError;
			expect(err.from).toBe("cancelled");
			expect(err.to).toBe("active");
			expect(err.subscriptionId).toBe("sub_xyz");
			expect(err.message).toContain("cancelled");
			expect(err.message).toContain("active");
			expect(err.message).toContain("sub_xyz");
		});

		it("fails open for unknown statuses (no throw)", () => {
			expect(() => assertTransition("active", "frobnicated", "sub_x")).not.toThrow();
			expect(() => assertTransition("zoinks", "active", "sub_x")).not.toThrow();
		});
	});
});
