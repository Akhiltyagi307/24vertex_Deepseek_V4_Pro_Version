import { describe, expect, it } from "vitest";

import { formatPracticeReportSubmittedLabel } from "@/lib/notifications/report-datetime-label";

describe("formatPracticeReportSubmittedLabel", () => {
	it("formats ISO timestamps in UTC", () => {
		expect(formatPracticeReportSubmittedLabel("2026-05-12T08:54:22.620598+00")).toBe("12 May 2026");
	});

	it("returns null for empty input", () => {
		expect(formatPracticeReportSubmittedLabel(null)).toBeNull();
		expect(formatPracticeReportSubmittedLabel(undefined)).toBeNull();
		expect(formatPracticeReportSubmittedLabel("")).toBeNull();
	});
});
