import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"src",
	"lib",
	"assignments",
	"queries.ts",
);
const previewActionSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"app",
	"teacher",
	"(protected)",
	"assignments",
	"student-eligibility-actions.ts",
);

describe("assignment queries source", () => {
	it("request-caches the teacher assignable student roster", () => {
		const source = readFileSync(sourcePath, "utf8");

		expect(source).toContain('import { cache } from "react";');
		expect(source).toContain("export const listTeacherAssignableStudents = cache(");
	});

	it("routes publish validation and preview through one eligibility helper", () => {
		const queriesSource = readFileSync(sourcePath, "utf8");
		const previewActionSource = readFileSync(previewActionSourcePath, "utf8");

		expect(queriesSource).toContain("export async function resolvePracticeAssignmentEligibleStudentIds");
		expect(queriesSource).toContain("const eligibility = await resolvePracticeAssignmentEligibleStudentIds(input);");
		expect(previewActionSource).toContain("resolvePracticeAssignmentEligibleStudentIds");
	});
});
