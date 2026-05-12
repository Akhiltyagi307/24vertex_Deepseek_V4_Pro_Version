import { describe, expect, it } from "vitest";

import { canonicalPracticeReportPdfStoragePath } from "@/lib/notifications/practice-report-pdf-path";

describe("canonicalPracticeReportPdfStoragePath", () => {
	it("uses student/test segments matching Storage uploads", () => {
		expect(canonicalPracticeReportPdfStoragePath("stu-1", "tst-2")).toBe("stu-1/tst-2.pdf");
	});
});
