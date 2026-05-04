import { describe, expect, it } from "vitest";

import { addPlanBillingInterval } from "@/lib/billing/add-plan-billing-interval";

describe("addPlanBillingInterval", () => {
	it("adds one month for monthly-ish intervals", () => {
		const a = new Date(2026, 0, 15);
		const b = addPlanBillingInterval(a, "monthly");
		expect(b.getFullYear()).toBe(2026);
		expect(b.getMonth()).toBe(1);
		expect(b.getDate()).toBe(15);
	});

	it("adds one year for yearly intervals", () => {
		const a = new Date(2026, 2, 1);
		const b = addPlanBillingInterval(a, "yearly");
		expect(b.getFullYear()).toBe(2027);
		expect(b.getMonth()).toBe(2);
	});

	it("defaults to +30 days for unknown interval labels", () => {
		const a = new Date(2026, 4, 1);
		const b = addPlanBillingInterval(a, "custom");
		expect(Math.round((b.getTime() - a.getTime()) / 86_400_000)).toBe(30);
	});
});
