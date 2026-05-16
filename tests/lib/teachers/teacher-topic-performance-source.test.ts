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
	"teachers",
	"teacher-topic-performance-queries.ts",
);

describe("teacher topic performance source", () => {
	it("returns before loading topic metadata when the scoped roster is empty", () => {
		const source = readFileSync(sourcePath, "utf8");
		const functionStart = source.indexOf("export async function listTeacherTopicStudentBreakdown");
		const emptyRosterReturn = source.indexOf("if (roster.length === 0)", functionStart);
		const metaQuery = source.indexOf("const metaRows = await db", functionStart);

		expect(functionStart).toBeGreaterThanOrEqual(0);
		expect(emptyRosterReturn).toBeGreaterThan(functionStart);
		expect(metaQuery).toBeGreaterThan(emptyRosterReturn);
	});
});
