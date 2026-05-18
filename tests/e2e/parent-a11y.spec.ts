/**
 * Parent-portal a11y sweep. Audit D19. Mirrors `tests/e2e/a11y-axe.spec.ts`
 * but runs over authenticated parent routes (reuses parent.json storage
 * state via the `parent` Playwright project).
 *
 * Skips when PLAYWRIGHT_PARENT_EMAIL is unset.
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

const PARENT_CRED_HINT =
	"Set PLAYWRIGHT_PARENT_EMAIL + PLAYWRIGHT_PARENT_PASSWORD in .env.local to run parent E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_PARENT_EMAIL?.trim(), PARENT_CRED_HINT);
});

async function runAxe(page: import("@playwright/test").Page): Promise<AxeResults> {
	await page.addScriptTag({ path: axePath });
	const results = await page.evaluate(async () => {
		const w = window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<unknown> } };
		const out = await w.axe.run(document, {
			runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
		});
		return out as AxeResults;
	});
	return results;
}

// Routes that should be reachable for a parent with at least one linked child.
// Each test self-skips if the route redirects elsewhere (e.g. select-student
// bounces when no child is active).
const ROUTES: ReadonlyArray<{ path: string; expectedPrefix?: string }> = [
	{ path: "/parent/select-student" },
	{ path: "/parent/link-child" },
	{ path: "/parent/dashboard", expectedPrefix: "/parent/" },
	{ path: "/parent/performance", expectedPrefix: "/parent/" },
	{ path: "/parent/reports", expectedPrefix: "/parent/" },
	{ path: "/parent/assignments", expectedPrefix: "/parent/" },
	{ path: "/parent/notifications", expectedPrefix: "/parent/" },
	{ path: "/parent/settings", expectedPrefix: "/parent/" },
	{ path: "/parent/subscription", expectedPrefix: "/parent/" },
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
