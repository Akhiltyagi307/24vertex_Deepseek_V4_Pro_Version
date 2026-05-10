/**
 * Practice visuals contract: figures expose an accessible name (matches
 * QuestionVisual's aria-label). Uses static HTML + injected axe-core (same
 * pattern as a11y-axe.spec.ts — no @axe-core/playwright dependency).
 */
import path from "node:path";

import { expect, test } from "@playwright/test";

const axePath: string = path.join(path.dirname(require.resolve("axe-core")), "axe.min.js");

type AxeViolation = {
	id: string;
	impact: string | null;
	description: string;
	nodes: { target: string[] }[];
};

type AxeResults = { violations: AxeViolation[] };

test("practice visual figure exposes accessible name (axe)", async ({ page }) => {
	await page.setContent(`
		<!DOCTYPE html>
		<html lang="en">
			<head><meta charset="utf-8"/><title>practice visual</title></head>
			<body>
				<main>
					<figure data-visual-surface aria-label="Test diagram: velocity vs time">
						<svg role="img" aria-hidden="true" width="200" height="100" xmlns="http://www.w3.org/2000/svg">
							<rect width="200" height="100" fill="#eee"/>
						</svg>
					</figure>
				</main>
			</body>
		</html>
	`);

	await page.addScriptTag({ path: axePath });
	const results = await page.evaluate(async () => {
		const w = window as unknown as { axe: { run: (ctx: Element, opts: unknown) => Promise<unknown> } };
		const main = document.querySelector("main");
		if (!main) return { violations: [] as AxeViolation[] };
		const out = await w.axe.run(main, {
			runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
			rules: { "color-contrast": { enabled: false } },
		});
		return out as AxeResults;
	});

	expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
