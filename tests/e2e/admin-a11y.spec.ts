/**
 * D26: axe-core a11y sweep for the admin portal. Mirrors the public-facing
 * `tests/e2e/a11y-axe.spec.ts` pattern: inject axe via script tag (no extra
 * wrapper package) and fail on critical / serious WCAG 2.1 AA violations.
 *
 * Skipped unless admin auth is wired:
 *   - PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD
 *
 * Routes covered are the heaviest admin surfaces — list pages, the SQL
 * console, the integrity dashboard. They are the most likely to host
 * icon-only buttons and complex grids surfaced by D24 / D25.
 */
import path from "node:path";

import { test, expect } from "@playwright/test";

import { loginAsAdmin } from "./admin-auth.helpers";

// Resolve axe-core's bundled file in the same way as the public sweep.
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

const ADMIN_ROUTES = [
	"/admin/dashboard",
	"/admin/users/students",
	"/admin/users/teachers",
	"/admin/billing/plans",
	"/admin/billing/coupons",
	"/admin/billing/subscriptions",
	"/admin/system/sql-console",
	"/admin/system/integrity",
	"/admin/audit",
	"/admin/communications/broadcasts",
	"/admin/curriculum/context-chunks",
];

test.describe("D26: admin portal axe sweep", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			"Set PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD to run.",
		);
	});

	for (const route of ADMIN_ROUTES) {
		test(`axe: ${route}`, async ({ page }) => {
			await loginAsAdmin(page);
			await page.goto(route);
			await page.waitForLoadState("networkidle");
			const results = await runAxe(page);
			const blocking = results.violations.filter(
				(v) => v.impact && SEVERITIES.has(v.impact),
			);
			if (blocking.length > 0) {
				const summary = blocking.map((v) => ({
					id: v.id,
					impact: v.impact,
					description: v.description,
					nodes: v.nodes.length,
				}));
				console.error(
					`axe found ${blocking.length} critical/serious violations on ${route}:`,
					JSON.stringify(summary, null, 2),
				);
			}
			expect(blocking, `critical/serious a11y violations on ${route}`).toHaveLength(0);
		});
	}
});
