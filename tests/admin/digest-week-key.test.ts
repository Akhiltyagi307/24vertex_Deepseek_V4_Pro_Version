import { describe, expect, it } from "vitest";

import { utcIsoWeekKey } from "@/lib/admin/digest/week-key";

describe("utcIsoWeekKey", () => {
	it("returns a stable YYYY-Www pattern", () => {
		const k = utcIsoWeekKey(new Date("2026-05-04T12:00:00.000Z"));
		expect(k).toMatch(/^\d{4}-W\d{2}$/);
	});
});
