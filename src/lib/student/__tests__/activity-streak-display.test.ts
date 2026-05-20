import { describe, expect, it } from "vitest";

import {
	formatLastActiveWeekLabel,
	formatLongestStreakLabel,
	formatStreakWeekDeadline,
	formatStreakWeekOfLabel,
} from "@/lib/student/activity-streak-display";

describe("activity-streak-display", () => {
	it("formats week-of label from date key", () => {
		expect(formatStreakWeekOfLabel("2026-05-12")).toMatch(/12/);
		expect(formatStreakWeekOfLabel(null)).toBeNull();
	});

	it("formats last active week", () => {
		expect(formatLastActiveWeekLabel("2026-05-12")).toContain("week of");
	});

	it("formats longest streak", () => {
		expect(formatLongestStreakLabel(5)).toBe("Longest streak: 5 weeks");
		expect(formatLongestStreakLabel(0)).toBeNull();
	});

	it("formats week deadline", () => {
		expect(formatStreakWeekDeadline(new Date("2026-05-20T12:00:00+05:30"))).toContain("India time");
	});
});
