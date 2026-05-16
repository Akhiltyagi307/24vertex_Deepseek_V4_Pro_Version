import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"app",
	"api",
	"teacher",
	"reports",
	"[testId]",
	"pdf",
	"route.tsx",
);

describe("teacher report PDF route source", () => {
	it("loads subject metadata and report metadata in parallel after the test row", () => {
		const source = readFileSync(sourcePath, "utf8");

		expect(source).toContain("const subjectRowPromise =");
		expect(source).toContain("const reportRowPromise =");
		expect(source).toContain("await Promise.all([subjectRowPromise, reportRowPromise])");
	});

	it("uses the shared verified teacher session guard before report access checks", () => {
		const source = readFileSync(sourcePath, "utf8");

		expect(source).toContain('import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher"');
		expect(source).toContain("const session = await getVerifiedTeacherSession()");
		expect(source.indexOf("const session = await getVerifiedTeacherSession()")).toBeLessThan(
			source.indexOf("const rate = await consumeTeacherReportPdfRateLimit"),
		);
		expect(source.indexOf("const session = await getVerifiedTeacherSession()")).toBeLessThan(
			source.indexOf("const allowed = await teacherOwnsAssignmentTest"),
		);
	});
});
