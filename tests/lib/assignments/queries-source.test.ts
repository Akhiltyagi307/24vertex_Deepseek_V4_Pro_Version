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

describe("assignment queries source", () => {
	it("request-caches the teacher assignable student roster", () => {
		const source = readFileSync(sourcePath, "utf8");

		expect(source).toContain('import { cache } from "react";');
		expect(source).toContain("export const listTeacherAssignableStudents = cache(");
	});
});
