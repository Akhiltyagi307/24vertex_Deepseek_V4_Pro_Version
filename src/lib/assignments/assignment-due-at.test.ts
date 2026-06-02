import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	assignmentDueMinDateKey,
	clampAssignmentDueAtToFuture,
	isAssignmentDueAtInPast,
} from "./assignment-due-at";

describe("assignment-due-at", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-03T10:00:00+05:30"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("treats instants before now as past", () => {
		expect(isAssignmentDueAtInPast("2026-06-01T12:00")).toBe(true);
		expect(isAssignmentDueAtInPast("2026-06-03T12:00")).toBe(false);
	});

	it("clamps to the next five-minute slot from now", () => {
		const clamped = clampAssignmentDueAtToFuture(new Date("2026-06-03T09:00:00+05:30"));
		expect(clamped.toISOString()).toBe("2026-06-03T04:30:00.000Z"); // 10:00 IST (on a 5-minute boundary)
	});

	it("uses today in the app time zone as the minimum calendar day", () => {
		expect(assignmentDueMinDateKey()).toBe("2026-06-03");
	});
});
