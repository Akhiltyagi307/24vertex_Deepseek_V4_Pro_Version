import { describe, expect, it } from "vitest";

import {
	applyWheelTimePartsToDate,
	snapMinuteToWheelStep,
	toWheelTime12Hour,
	toWheelTime24Hour,
	wheelTimePartsFromDate,
} from "./wheel-time";

describe("wheel-time", () => {
	it("converts between 12h and 24h", () => {
		expect(toWheelTime12Hour(0)).toEqual({ hour12: 12, period: "AM" });
		expect(toWheelTime12Hour(12)).toEqual({ hour12: 12, period: "PM" });
		expect(toWheelTime12Hour(13)).toEqual({ hour12: 1, period: "PM" });
		expect(toWheelTime24Hour(12, "AM")).toBe(0);
		expect(toWheelTime24Hour(1, "PM")).toBe(13);
	});

	it("snaps minutes to five-minute steps", () => {
		expect(snapMinuteToWheelStep(2)).toBe(0);
		expect(snapMinuteToWheelStep(33)).toBe(35);
	});

	it("round-trips through a Date", () => {
		const base = new Date(2026, 5, 3, 14, 27, 0);
		const parts = wheelTimePartsFromDate(base);
		expect(parts).toEqual({ hour24: 14, minute: 25 });
		const applied = applyWheelTimePartsToDate(new Date(2026, 5, 3, 9, 0, 0), parts);
		expect(applied.getHours()).toBe(14);
		expect(applied.getMinutes()).toBe(25);
	});
});
