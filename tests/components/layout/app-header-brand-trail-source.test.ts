import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("teacher header portal source", () => {
	it("supports the teacher portal copy path and uses it in the teacher top bar", () => {
		const trailSource = readFileSync(join(rootDir, "src/components/layout/app-header-brand-trail.tsx"), "utf8");
		const topBarSource = readFileSync(join(rootDir, "src/components/teacher/teacher-top-bar.tsx"), "utf8");

		expect(trailSource).toContain('export type HeaderPortal = "student" | "parent" | "teacher";');
		expect(trailSource).toContain('if (portal === "teacher")');
		expect(topBarSource).toContain('headerPortal="teacher"');
	});
});
