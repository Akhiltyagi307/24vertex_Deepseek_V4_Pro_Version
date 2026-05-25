/**
 * Smoke test for the public marketing landing. Locks in:
 *   - the page renders without console errors
 *   - the JSON-LD `Organization` + `WebSite` schema is present
 *   - the primary CTA navigates to the role-picker
 *   - the "Skip to main content" link works for keyboard users
 */
import { test, expect } from "@playwright/test";

test.describe("public landing", () => {
	test("renders the marketing landing without console errors", async ({ page }) => {
		const consoleErrors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		});
		page.on("pageerror", (err) => {
			consoleErrors.push(err.message);
		});

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

		await expect(page.locator("main#main-content")).toBeVisible();

		// CSP violations and hydration errors both show up here. Hydration
		// warnings are noisy in dev so ignore React's known patterns.
		const noise = /Download the React DevTools|favicon\.ico/i;
		const real = consoleErrors.filter((m) => !noise.test(m));
		expect(real, `unexpected console errors:\n${real.join("\n")}`).toEqual([]);
	});

	test("emits JSON-LD Organization and WebSite schema", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });

		const jsonLd = await page
			.locator('script[type="application/ld+json"]')
			.first()
			.textContent();
		expect(jsonLd, "JSON-LD script tag missing").toBeTruthy();

		const parsed = JSON.parse(jsonLd ?? "null") as {
			"@context"?: string;
			"@graph"?: unknown[];
		};
		expect(parsed["@context"]).toBe("https://schema.org");
		expect(Array.isArray(parsed["@graph"])).toBe(true);

		const blob = JSON.stringify(parsed);
		expect(blob).toContain('"Organization"');
		expect(blob).toContain('"WebSite"');
		expect(blob).toContain('"24Vertex"');
	});

	test("primary CTA navigates to /signup/role-picker", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

		// The primary CTA uses Radix's `render` prop to compose Button styling
		// onto an underlying `<a>`. Accessibility tree reports `button` role.
		// Multiple copies render in hero + pricing; the first one in source order
		// is the hero primary.
		const cta = page.getByRole("button", { name: /start 14-day trial/i }).first();
		await expect(cta).toBeVisible();

		await cta.click();
		await page.waitForURL(/\/signup\/role-picker$/, { timeout: 10_000 });
		expect(page.url()).toMatch(/\/signup\/role-picker$/);
	});

	test("theme toggle switches document dark class", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

		const toggle = page.getByRole("switch", { name: /theme/i }).first();
		await expect(toggle).toBeVisible();

		const initialTheme = await page.evaluate(() =>
			document.documentElement.classList.contains("dark") ? "dark" : "light",
		);
		await toggle.click();
		await expect
			.poll(
				async () =>
					page.evaluate(() =>
						document.documentElement.classList.contains("dark") ? "dark" : "light",
					),
				{ timeout: 3000 },
			)
			.not.toBe(initialTheme);
	});

	test("skip-to-main-content link is keyboard-reachable on first tab", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		// Anchor focus on <body> first — without this, headless Chromium's initial
		// focus state varies (sometimes the address bar) and the first Tab is a no-op.
		await page.evaluate(() => document.body.focus());

		await page.keyboard.press("Tab");
		const focused = await page.evaluate(() => {
			const el = document.activeElement;
			return el ? { tag: el.tagName, href: (el as HTMLAnchorElement).getAttribute("href") ?? null, text: el.textContent?.trim() ?? "" } : null;
		});
		expect(focused?.tag).toBe("A");
		expect(focused?.href).toBe("#main-content");
		expect(focused?.text).toMatch(/skip to main content/i);
	});
});
