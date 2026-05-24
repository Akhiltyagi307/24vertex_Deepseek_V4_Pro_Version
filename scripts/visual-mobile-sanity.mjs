/**
 * Marketing layout screenshots + optional layout metrics.
 * Usage: PORT=3001 node scripts/visual-mobile-sanity.mjs
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const outDir = join(process.cwd(), ".tmp/visual-mobile-sanity");

/** Project breakpoint: `medium:` = 768px (48rem). */
const MEDIUM_BREAKPOINT_PX = 768;

const SPECS = [
	{
		slug: "parent-dashboard-accountability",
		path: "/parent-dashboard",
		scrollTo: "One chapter map. Three people reading it.",
		clipHeight: 720,
		tabletClipHeight: 520,
	},
	{
		slug: "parent-dashboard-cta",
		path: "/parent-dashboard",
		scrollTo: "Get the first weak-chapter report this Sunday.",
		clipHeight: 720,
	},
	{
		slug: "adaptive-practice-hero-cta",
		path: "/adaptive-practice",
		scrollTo: "20 minutes on the 3 to 5 chapters",
		clipHeight: 720,
	},
	{
		slug: "adaptive-practice-cta",
		path: "/adaptive-practice",
		scrollTo: "Run the first targeted set this weekend.",
		clipHeight: 720,
	},
	{
		slug: "ai-tutor-hero-cta",
		path: "/ai-tutor",
		scrollTo: "Ask the doubt you would not raise in class.",
		clipHeight: 720,
	},
	{
		slug: "ai-tutor-cta",
		path: "/ai-tutor",
		scrollTo: "Ask the doubt you have been avoiding tonight.",
		clipHeight: 720,
	},
];

const VIEWPORTS = [
	{ name: "iphone-13", ...devices["iPhone 13"], specs: SPECS },
	{
		name: "iphone-se",
		viewport: { width: 320, height: 568 },
		userAgent: devices["iPhone 13"].userAgent,
		specs: SPECS,
	},
	{
		name: "tablet-768",
		viewport: { width: MEDIUM_BREAKPOINT_PX, height: 1024 },
		userAgent: devices["iPad (gen 7)"].userAgent,
		/** Tablet pass focuses on the accountability 3-column breakpoint. */
		specs: SPECS.filter((s) => s.slug === "parent-dashboard-accountability"),
	},
];

async function measureAccountabilityStrip(page, width) {
	await page.goto(`${baseURL}/parent-dashboard`, { waitUntil: "domcontentloaded", timeout: 120_000 });
	await page.waitForTimeout(1500);
	await page.getByRole("heading", { name: /One chapter map/i }).scrollIntoViewIfNeeded();

	const list = page.locator("section").filter({ hasText: "One chapter map" }).locator("ul").first();
	const grid = await list.evaluate((el) => {
		const style = window.getComputedStyle(el);
		return {
			display: style.display,
			gridTemplateColumns: style.gridTemplateColumns,
			columnCount: style.columnCount,
		};
	});

	const items = list.locator(":scope > li");
	const n = await items.count();
	const boxes = [];
	for (let i = 0; i < n; i++) {
		const box = await items.nth(i).boundingBox();
		boxes.push(box);
	}

	const sameRow =
		boxes.length >= 3 &&
		Math.abs((boxes[0]?.y ?? 0) - (boxes[1]?.y ?? 0)) < 4 &&
		Math.abs((boxes[1]?.y ?? 0) - (boxes[2]?.y ?? 0)) < 4;

	const threeCol = grid.display === "grid" && grid.gridTemplateColumns.split(" ").length >= 3;

	console.log(
		JSON.stringify({
			width,
			atMediumBreakpoint: width >= MEDIUM_BREAKPOINT_PX,
			grid,
			rowCount: n,
			sameRow,
			threeCol,
			heights: boxes.map((b) => Math.round(b?.height ?? 0)),
		}),
	);
}

async function main() {
	await mkdir(outDir, { recursive: true });
	const browser = await chromium.launch();

	for (const vp of VIEWPORTS) {
		const context = await browser.newContext({ ...vp, colorScheme: "light" });
		const page = await context.newPage();
		const width = vp.viewport?.width ?? 390;

		if (vp.name === "tablet-768") {
			await measureAccountabilityStrip(page, width);
		}

		for (const spec of vp.specs) {
			const url = `${baseURL}${spec.path}`;
			await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
			const heading = page.getByRole("heading", { name: spec.scrollTo });
			await heading.scrollIntoViewIfNeeded();
			await page.waitForTimeout(400);
			const box = await heading.boundingBox();
			const clipY = Math.max(0, (box?.y ?? 0) - 24);
			const height = spec.tabletClipHeight && vp.name === "tablet-768" ? spec.tabletClipHeight : spec.clipHeight;
			await page.screenshot({
				path: join(outDir, `${vp.name}-${spec.slug}.png`),
				clip: { x: 0, y: clipY, width, height },
			});
		}

		await context.close();
	}

	await browser.close();
	console.log(`Screenshots written to ${outDir}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
