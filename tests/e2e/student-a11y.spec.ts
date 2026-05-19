/**
 * Student-portal a11y sweep. Audit D23. Mirrors `tests/e2e/parent-a11y.spec.ts`
 * but runs over authenticated student routes (reuses student storage state
 * via the `student` Playwright project — see `playwright.config.ts`).
 *
 * Skips when PLAYWRIGHT_STUDENT_EMAIL is unset.
 */
import path from "node:path";

import { expect, test } from "@playwright/test";

const axePath: string = path.join(path.dirname(require.resolve("axe-core")), "axe.min.js");

type AxeViolation = {
	id: string;
	impact: "minor" | "moderate" | "serious" | "critical" | null;
	description: string;
	nodes: { target: string[] }[];
};

type AxeResults = { violations: AxeViolation[] };

const SEVERITIES = new Set(["critical", "serious"]);

const STUDENT_CRED_HINT =
	"Set PLAYWRIGHT_STUDENT_EMAIL + PLAYWRIGHT_STUDENT_PASSWORD in .env.local to run student E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_STUDENT_EMAIL?.trim(), STUDENT_CRED_HINT);
});

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

// Routes that should be reachable for a verified student. Each test self-skips
// if the route bounces elsewhere (e.g. /student/practice/[testId] requires an
// active in-progress test which isn't seeded in the auth fixture).
const ROUTES: ReadonlyArray<{ path: string; expectedPrefix?: string }> = [
	{ path: "/student/dashboard", expectedPrefix: "/student/" },
	{ path: "/student/practice", expectedPrefix: "/student/" },
	{ path: "/student/performance", expectedPrefix: "/student/" },
	{ path: "/student/reports", expectedPrefix: "/student/" },
	{ path: "/student/assignments", expectedPrefix: "/student/" },
	{ path: "/student/doubt-chat", expectedPrefix: "/student/" },
	{ path: "/student/notifications", expectedPrefix: "/student/" },
	{ path: "/student/settings", expectedPrefix: "/student/" },
	{ path: "/student/subscription", expectedPrefix: "/student/" },
];

for (const route of ROUTES) {
	test(`a11y: ${route.path} has no critical/serious WCAG 2.1 AA violations`, async ({ page }) => {
		await page.goto(route.path, { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

		const finalPath = new URL(page.url()).pathname;
		if (route.expectedPrefix && !finalPath.startsWith(route.expectedPrefix)) {
			test.skip(true, `route bounced from ${route.path} to ${finalPath}`);
		}

		const results = await runAxe(page);
		const blocking = results.violations.filter((v) => SEVERITIES.has(String(v.impact)));
		const summary = blocking
			.map(
				(v) =>
					`[${v.impact}] ${v.id} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}): ${v.description}`,
			)
			.join("\n");
		expect(blocking, `axe violations on ${route.path}:\n${summary}`).toEqual([]);
	});
}
