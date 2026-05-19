/**
 * Teacher portal accessibility sweep. Mirrors `a11y-axe.spec.ts` (which runs
 * unauthenticated) but loads each authenticated `/teacher/*` route under the
 * `teacher` Playwright project (which preloads the verified-teacher storage
 * state). Fails on any critical/serious WCAG 2.1 AA violation.
 *
 * Routes covered:
 *   - /teacher/dashboard
 *   - /teacher/assignments
 *   - /teacher/settings
 *   - /teacher/student-performance
 *   - /teacher/topic-performance
 *
 * Skips cleanly when PLAYWRIGHT_TEACHER_EMAIL is unset (auth setup also skips).
 */
import path from "node:path";

import { test, expect } from "@playwright/test";

const TEACHER_CRED_HINT =
	"Set PLAYWRIGHT_TEACHER_EMAIL + PLAYWRIGHT_TEACHER_PASSWORD in .env.local to run teacher a11y E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_TEACHER_EMAIL?.trim(), TEACHER_CRED_HINT);
});

const axePath: string = path.join(path.dirname(require.resolve("axe-core")), "axe.min.js");

type AxeViolation = {
	id: string;
	impact: "minor" | "moderate" | "serious" | "critical" | null;
	description: string;
	nodes: { target: string[] }[];
};

type AxeResults = { violations: AxeViolation[] };

const SEVERITIES = new Set(["critical", "serious"]);

async function runAxe(page: import("@playwright/test").Page): Promise<AxeResults> {
	await page.addScriptTag({ path: axePath });
	const results = await page.evaluate(async () => {
		const w = window as unknown as {
			axe: { run: (ctx: Document, opts: unknown) => Promise<unknown> };
		};
		const out = await w.axe.run(document, {
			runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
		});
		return out as AxeResults;
	});
	return results;
}

const ROUTES = [
	"/teacher/dashboard",
	"/teacher/assignments",
	"/teacher/settings",
	"/teacher/student-performance",
	"/teacher/topic-performance",
];

for (const route of ROUTES) {
	test(`a11y: ${route} has no critical/serious WCAG 2.1 AA violations`, async ({ page }) => {
		await page.goto(route, { waitUntil: "domcontentloaded" });
		// Allow deferred islands (motion, charts, deferred org-roster tab) to settle.
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

		const results = await runAxe(page);
		const significant = results.violations.filter((v) => SEVERITIES.has(v.impact ?? ""));

		expect(
			significant,
			`Critical/serious WCAG violations on ${route}:\n${significant
				.map((v) => `  - ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
				.join("\n")}`,
		).toHaveLength(0);
	});
}
