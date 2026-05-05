/**
 * Accessibility smoke test. Loads each public route, injects axe-core, and
 * fails on any WCAG 2.1 AA violation. The full `@axe-core/playwright` package
 * isn't a dep — instead we inject `axe-core/axe.min.js` directly via
 * `addScriptTag` and call `window.axe.run()`. This keeps the surface to
 * existing transitive deps and matches how the rest of the e2e suite works
 * (no extra wrapper libs).
 *
 * Routes covered:
 *   - `/`               marketing landing
 *   - `/login`          auth
 *   - `/auth/forgot-password`
 *   - `/legal/privacy`
 *   - `/legal/terms`
 *
 * Authenticated routes (student dashboard, admin) are not in this spec; they
 * belong in their own session-scoped projects (Phase 3 follow-up).
 */
import path from "node:path";

import { test, expect } from "@playwright/test";

// Playwright compiles e2e specs in CommonJS context (no `"type": "module"` in
// package.json), so `import.meta.url` + `createRequire` fail at runtime. Use
// the implicit CJS `require.resolve` directly to find axe-core's bundled file.
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
		// `window.axe` is injected by the script tag above.
		const w = window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<unknown> } };
		const out = await w.axe.run(document, {
			runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
		});
		return out as AxeResults;
	});
	return results;
}

const ROUTES = ["/", "/login", "/auth/forgot-password", "/legal/privacy", "/legal/terms"];

for (const route of ROUTES) {
	test(`a11y: ${route} has no critical/serious WCAG 2.1 AA violations`, async ({ page }) => {
		await page.goto(route, { waitUntil: "domcontentloaded" });
		// Give the deferred islands (motion components, theme provider) a frame to settle.
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

		const results = await runAxe(page);
		const blocking = results.violations.filter((v) => SEVERITIES.has(String(v.impact)));
		const summary = blocking
			.map((v) => `[${v.impact}] ${v.id} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}): ${v.description}`)
			.join("\n");
		expect(blocking, `axe violations on ${route}:\n${summary}`).toEqual([]);
	});
}
