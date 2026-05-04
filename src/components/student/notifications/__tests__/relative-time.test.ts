import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/components/student/notifications/relative-time";

const NOW = new Date("2026-05-04T12:00:00.000Z");

describe("formatRelativeTime", () => {
	it("returns 'just now' for sub-45s deltas", () => {
		const t = new Date(NOW.getTime() - 10 * 1000).toISOString();
		expect(formatRelativeTime(t, NOW)).toBe("just now");
	});

	it("formats minutes for < 1h", () => {
		const t = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
		expect(formatRelativeTime(t, NOW)).toBe("5m ago");
	});

	it("formats hours for < 24h", () => {
		const t = new Date(NOW.getTime() - 3 * 3600 * 1000).toISOString();
		expect(formatRelativeTime(t, NOW)).toBe("3h ago");
	});

	it("formats days and weeks", () => {
		expect(formatRelativeTime(new Date(NOW.getTime() - 2 * 86400_000).toISOString(), NOW)).toBe(
			"2d ago",
		);
		expect(formatRelativeTime(new Date(NOW.getTime() - 10 * 86400_000).toISOString(), NOW)).toBe(
			"1w ago",
		);
	});

	it("returns empty string for invalid input", () => {
		expect(formatRelativeTime("not-a-date", NOW)).toBe("");
	});
});
