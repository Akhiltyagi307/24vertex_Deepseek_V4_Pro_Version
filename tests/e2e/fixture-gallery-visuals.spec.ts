/**
 * Visual-regression snapshots for every fixture in the dev-only
 * `/dev/practice/visuals/fixture-gallery` route. One screenshot per fixture
 * means a renderer regression (blank SVG, overlapping labels, broken
 * smiles-drawer parse, function-plot crash) shows up as a pixel diff in
 * CI rather than shipping silently. Catches the class of bugs the prior
 * audit flagged as our biggest unmonitored risk for the visuals subtree.
 *
 * Why this route: it loads every fixture under
 * `tests/eval-visuals/fixtures/<subject>/` through the real `<QuestionVisual>`
 * dispatcher (same dispatcher used in the live practice session), so a
 * passing snapshot here means the real renderers + their lazy-loaded chunks
 * work end-to-end with no live LLM in the loop. The gallery is gated to
 * non-production by `NODE_ENV === "production"` (see the route page), so
 * it is unreachable on Vercel — that gate is OFF during `next dev` and
 * `next start` on local/CI, which is exactly when this spec runs.
 *
 * Fixture coverage at last audit: 91 fixtures across all 20 visual kinds.
 *
 * Baseline lifecycle:
 *
 *   Baselines must be generated on a Linux runner (CI or Docker) to avoid
 *   Mac-vs-CI font-hinting drift. On the first run, no PNGs exist and every
 *   `toHaveScreenshot` call will fail with "missing snapshot" — that is
 *   expected. To seed the baselines:
 *
 *     docker run --rm -v "$PWD:/work" -w /work \
 *       mcr.microsoft.com/playwright:v1.50.0-noble \
 *       pnpm exec playwright test tests/e2e/fixture-gallery-visuals.spec.ts \
 *       --project=unauth --update-snapshots
 *
 *   The resulting `tests/e2e/fixture-gallery-visuals.spec.ts-snapshots/`
 *   directory should be committed once, then the spec runs as a gate.
 *
 *   To intentionally update a baseline (e.g. after a renderer style change),
 *   re-run the same docker command. Review the diff in the PR carefully —
 *   a wider-than-1% pixel diff usually means a real regression, not a font
 *   shift.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const FIXTURES_DIR = path.resolve(process.cwd(), "tests", "eval-visuals", "fixtures");

type Fixture = {
	subject: string;
	fileName: string;
	baseName: string;
	kind: string | null;
};

function loadFixtures(): Fixture[] {
	const out: Fixture[] = [];
	let subjects: string[] = [];
	try {
		subjects = readdirSync(FIXTURES_DIR).filter((name) =>
			statSync(path.join(FIXTURES_DIR, name)).isDirectory(),
		);
	} catch {
		return out;
	}
	for (const subject of subjects.sort()) {
		const subjectDir = path.join(FIXTURES_DIR, subject);
		let files: string[] = [];
		try {
			files = readdirSync(subjectDir).filter((f) => f.endsWith(".json"));
		} catch {
			continue;
		}
		for (const fileName of files.sort()) {
			const filePath = path.join(subjectDir, fileName);
			try {
				const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
					visual?: { spec?: { kind?: unknown } | null } | null;
				};
				if (raw.visual == null) continue;
				const kind =
					raw.visual?.spec && typeof raw.visual.spec.kind === "string"
						? raw.visual.spec.kind
						: null;
				out.push({
					subject,
					fileName,
					baseName: fileName.replace(/\.json$/, ""),
					kind,
				});
			} catch {
				// Unparseable fixtures are surfaced by `pnpm eval:visuals` — skip here.
			}
		}
	}
	return out;
}

const fixtures = loadFixtures();

test.describe("fixture-gallery visual snapshots", () => {
	test.describe.configure({ mode: "default" });

	test.beforeEach(async ({ page }) => {
		// Match the live student experience and reduce snapshot non-determinism.
		await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
		await page.setViewportSize({ width: 1280, height: 800 });
		// One nav per test — Playwright's default isolation is per-test, and the
		// gallery is fast enough that the per-test reload is cheaper than sharing
		// state across tests (which would risk one fixture's renderer mutating
		// another's DOM).
		await page.goto("/dev/practice/visuals/fixture-gallery", {
			waitUntil: "domcontentloaded",
		});
		// Let dynamically-imported renderers settle. Plotly + function-plot
		// inject after hydration; smiles-drawer parses async.
		await page
			.waitForLoadState("networkidle", { timeout: 15_000 })
			.catch(() => undefined);
	});

	for (const fx of fixtures) {
		test(`visual: ${fx.subject}/${fx.baseName} (${fx.kind ?? "unknown"})`, async ({ page }) => {
			const li = page.locator(`[data-fixture-key="${fx.subject}/${fx.fileName}"]`);
			await expect(
				li,
				`fixture ${fx.subject}/${fx.fileName} missing in gallery DOM`,
			).toBeVisible({ timeout: 10_000 });

			// Wait for the renderer to actually have produced DOM content. Most
			// kinds render SVG; statistics_chart (box-plot subkind) uses Plotly
			// which mounts a <canvas>. Either is sufficient evidence of a real
			// render attempt.
			await page
				.waitForFunction(
					(key) => {
						const el = document.querySelector(`[data-fixture-key="${key}"]`);
						if (!el) return false;
						return (
							el.querySelector("svg, canvas, table, [data-question-visual-kind]") != null
						);
					},
					`${fx.subject}/${fx.fileName}`,
					{ timeout: 12_000 },
				)
				.catch(() => undefined);
			// Final small settle for D3-based renderers (function-plot,
			// economics-curve) that paint outside React's commit cycle.
			await page.waitForTimeout(300);

			// Mask elements whose text varies between runs and shouldn't affect
			// the visual: the schema-mismatch <details> (text comes from Zod
			// error messages, which drift) and the fixture-name <code> badge.
			const masks = [
				li.locator("details"),
				li.locator("code").first(),
			];

			await expect(li).toHaveScreenshot(`${fx.subject}-${fx.baseName}.png`, {
				animations: "disabled",
				caret: "hide",
				mask: masks,
				maxDiffPixelRatio: 0.01,
				maxDiffPixels: 200,
				timeout: 15_000,
			});
		});
	}
});
