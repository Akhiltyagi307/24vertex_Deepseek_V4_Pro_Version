/**
 * Visual regression baseline. Snapshots a small set of public, mostly-static
 * routes so an unintended layout / typography / palette regression surfaces
 * in CI before it ships.
 *
 * Authenticated routes (student dashboard, admin) are intentionally NOT
 * snapshotted here — too much real-data noise without seeded fixtures, and
 * the dynamic content (stats, recent activity) makes baseline maintenance a
 * full-time job. Add those later via fixtures + the role-scoped Playwright
 * projects when the seeded data path lands.
 *
 * First run: snapshots are written to disk. Second run: compared to disk.
 * Update intentionally with `pnpm exec playwright test --update-snapshots
 * tests/e2e/visual-snapshots.spec.ts`.
 *
 * Diff tolerance: 1% of the page (`maxDiffPixelRatio: 0.01`). Tighter than
 * that and font subpixel rendering across CI runners flakes; looser and we
 * miss real regressions like a misaligned section break.
 */
import { test, expect } from "@playwright/test";

const ROUTES: { path: string; name: string }[] = [
	{ path: "/", name: "marketing-landing" },
	{ path: "/login", name: "login" },
	{ path: "/auth/forgot-password", name: "forgot-password" },
	{ path: "/legal/privacy", name: "legal-privacy" },
	{ path: "/legal/terms", name: "legal-terms" },
];

for (const { path, name } of ROUTES) {
	test(`visual: ${name}`, async ({ page }) => {
		await page.goto(path, { waitUntil: "domcontentloaded" });

		// Let motion components, theme provider, and any deferred islands settle
		// before the snapshot — otherwise the first run captures a half-hydrated
		// frame and every subsequent run "regresses" to the fully-hydrated state.
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

		// Force prefers-reduced-motion to defeat any one-off intro animation that
		// hasn't completed when we snapshot. Layout-level motion already honours
		// this preference (per DESIGN.md), so the result matches the production
		// experience for users with that preference set.
		await page.emulateMedia({ reducedMotion: "reduce" });

		// Pin the viewport so consecutive runs can't drift on default size.
		await page.setViewportSize({ width: 1280, height: 800 });

		await expect(page).toHaveScreenshot(`${name}.png`, {
			fullPage: true,
			animations: "disabled",
			maxDiffPixelRatio: 0.01,
		});
	});
}
