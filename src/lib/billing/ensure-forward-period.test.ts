import { describe, expect, it } from "vitest";

import { ensureForwardPeriod } from "@/lib/billing/ensure-forward-period";

const DAY_MS = 86_400_000;

describe("ensureForwardPeriod", () => {
	it("passes a valid forward period through unchanged", () => {
		const start = "2026-01-15T00:00:00.000Z";
		const end = "2026-02-15T00:00:00.000Z";
		expect(ensureForwardPeriod(start, end, "month")).toEqual({ startIso: start, endIso: end });
	});

	it("repairs a zero-length period (start === end) using the monthly interval", () => {
		const start = "2026-01-15T00:00:00.000Z";
		const res = ensureForwardPeriod(start, start, "month");
		expect(res.startIso).toBe(start);
		const gapDays = (new Date(res.endIso).getTime() - new Date(start).getTime()) / DAY_MS;
		expect(gapDays).toBeGreaterThanOrEqual(28);
		expect(gapDays).toBeLessThanOrEqual(31);
	});

	it("repairs a zero-length period using the yearly interval", () => {
		const start = "2026-01-15T00:00:00.000Z";
		const res = ensureForwardPeriod(start, start, "year");
		const gapDays = (new Date(res.endIso).getTime() - new Date(start).getTime()) / DAY_MS;
		expect(gapDays).toBeGreaterThanOrEqual(365);
		expect(gapDays).toBeLessThanOrEqual(366);
	});

	it("repairs an end that precedes the start", () => {
		const start = "2026-03-15T00:00:00.000Z";
		const end = "2026-02-15T00:00:00.000Z";
		const res = ensureForwardPeriod(start, end, "month");
		expect(new Date(res.endIso).getTime()).toBeGreaterThan(new Date(start).getTime());
	});

	it("falls back to a forward window when the start is unparseable", () => {
		const res = ensureForwardPeriod("not-a-date", "also-bad", "month");
		expect(Number.isFinite(new Date(res.startIso).getTime())).toBe(true);
		expect(new Date(res.endIso).getTime()).toBeGreaterThan(new Date(res.startIso).getTime());
	});
});
