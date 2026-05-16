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
	"teacher-submissions-hub.ts",
);

describe("teacher submissions hub source", () => {
	it("starts assignment metadata and test report reads in parallel", () => {
		const source = readFileSync(sourcePath, "utf8");

		expect(source).toContain("const assignmentMetaRowsPromise =");
		expect(source).toContain("const reportsPromise =");
		expect(source).toContain("await Promise.all([assignmentMetaRowsPromise, reportsPromise])");
	});
});
