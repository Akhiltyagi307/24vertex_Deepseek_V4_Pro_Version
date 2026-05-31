import { describe, expect, it } from "vitest";

import { defaultWhenForChange, quotePlanChange } from "../proration";

describe("quotePlanChange", () => {
	it("upgrade monthly → annual mid-cycle returns positive delta", () => {
		// Monthly = ₹600 paise=60000, annual = ₹6000 paise=600000.
		// Mid-cycle (50% remaining) of a monthly cycle: delta = (600000 - 60000) * 0.5 = 270000.
		const periodStart = new Date("2026-05-01T00:00:00Z");
		const periodEnd = new Date("2026-06-01T00:00:00Z");
		const now = new Date("2026-05-16T12:00:00Z"); // ~50% remaining
		const q = quotePlanChange({
			fromPlanCode: "pro_monthly",
			toPlanCode: "pro_annual",
			currentPeriodStart: periodStart,
			currentPeriodEnd: periodEnd,
			now,
		});
		expect(q.isUpgrade).toBe(true);
		expect(q.fromPricePaise).toBe(60000);
		expect(q.toPricePaise).toBe(600000);
		// Loose: somewhere near 50% × 540000 = 270000, allow ±10% for calendar-month math.
		expect(q.deltaPaise).toBeGreaterThan(240000);
		expect(q.deltaPaise).toBeLessThan(300000);
	});

	it("downgrade annual → monthly mid-cycle returns negative delta (credit)", () => {
		const periodStart = new Date("2026-05-01T00:00:00Z");
		const periodEnd = new Date("2027-05-01T00:00:00Z"); // 1 year
		const now = new Date("2026-11-01T00:00:00Z"); // 50% in
		const q = quotePlanChange({
			fromPlanCode: "pro_annual",
			toPlanCode: "pro_monthly",
			currentPeriodStart: periodStart,
			currentPeriodEnd: periodEnd,
			now,
		});
		expect(q.isUpgrade).toBe(false);
		expect(q.deltaPaise).toBeLessThan(0);
	});

	it("returns zero delta when called at period end (nothing remaining)", () => {
		const periodStart = new Date("2026-05-01T00:00:00Z");
		const periodEnd = new Date("2026-06-01T00:00:00Z");
		const q = quotePlanChange({
			fromPlanCode: "pro_monthly",
			toPlanCode: "pro_annual",
			currentPeriodStart: periodStart,
			currentPeriodEnd: periodEnd,
			now: periodEnd,
		});
		expect(q.deltaPaise).toBe(0);
		expect(q.periodRemainingSec).toBe(0);
	});

	it("clamps negative remaining-time to zero (now past period_end)", () => {
		const periodStart = new Date("2026-05-01T00:00:00Z");
		const periodEnd = new Date("2026-06-01T00:00:00Z");
		const now = new Date("2026-07-01T00:00:00Z"); // past
		const q = quotePlanChange({
			fromPlanCode: "pro_monthly",
			toPlanCode: "pro_annual",
			currentPeriodStart: periodStart,
			currentPeriodEnd: periodEnd,
			now,
		});
		expect(q.periodRemainingSec).toBe(0);
		expect(q.deltaPaise).toBe(0);
	});

	it("returns full upgrade price when called at period start (all remaining)", () => {
		const periodStart = new Date("2026-05-01T00:00:00Z");
		const periodEnd = new Date("2026-06-01T00:00:00Z");
		const q = quotePlanChange({
			fromPlanCode: "pro_monthly",
			toPlanCode: "pro_annual",
			currentPeriodStart: periodStart,
			currentPeriodEnd: periodEnd,
			now: periodStart,
		});
		// 100% remaining ⇒ delta = 540000
		expect(q.deltaPaise).toBe(540000);
	});
});

describe("defaultWhenForChange", () => {
	it("upgrade defaults to now", () => {
		expect(defaultWhenForChange("pro_monthly", "pro_annual")).toBe("now");
	});

	it("downgrade defaults to cycle_end", () => {
		expect(defaultWhenForChange("pro_annual", "pro_monthly")).toBe("cycle_end");
	});

	it("equal-price (self) defaults to now (treated as upgrade-or-equal)", () => {
		expect(defaultWhenForChange("pro_monthly", "pro_monthly")).toBe("now");
	});
});
