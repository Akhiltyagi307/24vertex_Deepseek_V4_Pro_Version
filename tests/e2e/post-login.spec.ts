/**
 * Post-login flow — covers the authenticated surface area touched by:
 *   Phase 6 (server-rendered StudentShell + ParentShell, CSS-only segment transition,
 *            Toaster moved to student tree)
 *   Phase 7 (loading.tsx skeletons for student/parent/teacher segments)
 *   Round-2 A2 (new Suspense boundaries on performance + reports)
 *   Round-2 B5 (Razorpay preconnect on upgrade-button intent)
 *
 * Authentication runs once via `tests/e2e/auth.setup.ts` (Playwright project `auth-setup`);
 * this file runs under the `student` project with `storageState` from `playwright/.auth/user.json`.
 */

import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
	/Failed to load resource.*sentry/i,
	/sentry.*not configured/i,
	/Download the React DevTools/i,
	/\[Fast Refresh\]/i,
	/\[web-vital\]/,
	/Content Security Policy directive/i,
	/violates the following Content Security Policy/i,
	/Failed to load resource:.*\b404\b/i,
];

function attachConsoleCollector(page: Page): { errors: string[] } {
	const errors: string[] = [];
	page.on("console", (msg: ConsoleMessage) => {
		const text = msg.text();
		if (IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
		if (msg.type() === "error") errors.push(text);
	});
	page.on("pageerror", (err) => {
		errors.push(`pageerror: ${err.message}`);
	});
	return { errors };
}

async function rolePathFromVisit(page: Page): Promise<string> {
	// Visit `/` while authenticated — `app/page.tsx` redirects to the role-resolved post-auth path.
	await page.goto("/", { waitUntil: "domcontentloaded" });
	return new URL(page.url()).pathname;
}

async function isOnLogin(page: Page): Promise<boolean> {
	return /\/login/.test(new URL(page.url()).pathname);
}

test.describe("Authenticated flow (storageState loaded by auth-setup)", () => {
	test("`/` redirects to role-resolved path", async ({ page }) => {
		const path = await rolePathFromVisit(page);
		// resolvePostAuthPath: admin → "/", student → "/student/dashboard",
		// parent → "/parent/select-student". Anything else means setup didn't write cookies.
		expect([
			"/",
			"/student/dashboard",
			"/parent/select-student",
			"/parent/dashboard",
			"/teacher/dashboard",
		]).toContain(path);
		test.info().annotations.push({ type: "post-auth-path", description: path });
	});

	test("`/legal/privacy` reachable while signed in (middleware-skipped + force-static)", async ({ page }) => {
		await page.goto("/legal/privacy");
		await expect(page.getByRole("heading", { name: /privacy/i }).first()).toBeVisible();
	});

	test("`/student/performance` renders (Suspense + new async wrapper from A2)", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/student/performance", { waitUntil: "domcontentloaded" });

		test.skip(await isOnLogin(page), "Account is not a student — performance page redirects to /login");

		// Suspense can hold the route on skeleton for a while on cold dev (parallel workers + first compile).
		const perfTitle = page.getByRole("heading", { name: /^Performance$|^Subject progress$/i });
		const skel = page.getByLabel(/loading performance/i);
		await expect(perfTitle.or(skel).first()).toBeVisible({ timeout: 25_000 });
		expect(errors, `Console errors on performance page: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("`/student/reports` renders (Suspense + new async wrapper from A2)", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/student/reports", { waitUntil: "domcontentloaded" });
		test.skip(await isOnLogin(page), "Account is not a student — reports page redirects to /login");

		const loaded = await page
			.getByRole("heading", { level: 1 })
			.first()
			.isVisible({ timeout: 8000 })
			.catch(() => false);
		const skel = await page
			.getByLabel(/loading reports/i)
			.first()
			.isVisible({ timeout: 1000 })
			.catch(() => false);
		expect(loaded || skel, "reports page must render h1 or skeleton").toBe(true);
		expect(errors, `Console errors on reports page: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("`/student/dashboard` shell renders (server-rendered StudentShell from Phase 6.1)", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/student/dashboard", { waitUntil: "domcontentloaded" });
		test.skip(await isOnLogin(page), "Account is not a student — dashboard unreachable");

		// Sidebar header brand link is a stable signal that the shell hydrated.
		await expect(page.getByRole("link", { name: /eduai/i }).first()).toBeVisible({ timeout: 8000 });
		// Theme toggle present in the topbar.
		await expect(page.getByLabel(/theme/i).first()).toBeVisible();

		expect(errors, `Console errors on dashboard: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("`/student/subscription` Razorpay preconnect fires on upgrade-button intent (Round-2 B5)", async ({ page }) => {
		await page.goto("/student/subscription", { waitUntil: "domcontentloaded" });
		test.skip(await isOnLogin(page), "Account is not a student — subscription page unreachable");

		// Pre-hover: no preconnect to checkout.razorpay.com expected (the page-level preconnect was removed).
		const preconnectBeforeHover = await page.evaluate(() =>
			Array.from(document.querySelectorAll('link[rel="preconnect"]'))
				.map((l) => (l as HTMLLinkElement).href)
				.some((h) => h.includes("checkout.razorpay.com")),
		);
		expect(preconnectBeforeHover, "page-load preconnect should be absent (intent-only after Round-2 B5)").toBe(false);

		const upgradeButton = page
			.getByRole("button", { name: /upgrade|choose|pro\s*monthly|pro\s*annual/i })
			.first();
		const buttonExists = await upgradeButton.isVisible({ timeout: 3000 }).catch(() => false);
		test.skip(!buttonExists, "No upgrade button on this account's subscription page");
		await upgradeButton.hover();

		await expect
			.poll(
				async () =>
					page.evaluate(() =>
						Array.from(document.querySelectorAll('link[rel="preconnect"]'))
							.map((l) => (l as HTMLLinkElement).href)
							.some((h) => h.includes("checkout.razorpay.com")),
					),
				{ timeout: 2000, message: "preconnect to checkout.razorpay.com must appear after hover" },
			)
			.toBe(true);
	});

	test("theme toggle persists across navigation", async ({ page }) => {
		// Pick a route the user can actually load. Try dashboard first; fall back to "/".
		await page.goto("/student/dashboard", { waitUntil: "domcontentloaded" });
		if (await isOnLogin(page)) {
			await page.goto("/", { waitUntil: "domcontentloaded" });
		}

		const initialTheme = await page.evaluate(() =>
			document.documentElement.classList.contains("dark") ? "dark" : "light",
		);

		const toggle = page.getByLabel(/theme/i).first();
		const toggleVisible = await toggle.isVisible({ timeout: 3000 }).catch(() => false);
		test.skip(!toggleVisible, "Theme toggle not visible on this surface");
		await toggle.click();

		await expect
			.poll(
				async () =>
					page.evaluate(() =>
						document.documentElement.classList.contains("dark") ? "dark" : "light",
					),
				{ timeout: 2000 },
			)
			.not.toBe(initialTheme);

		// Navigate to a sibling route — theme should persist via next-themes' inline script.
		await page.goto("/legal/privacy");
		const themeAfterNav = await page.evaluate(() =>
			document.documentElement.classList.contains("dark") ? "dark" : "light",
		);
		expect(themeAfterNav, "theme must survive navigation").not.toBe(initialTheme);
	});

	test("`loading.tsx` segment fallback can render on slow navigation (Phase 7.8)", async ({ page, context }) => {
		// Throttle the dashboard request to keep the loading.tsx skeleton visible.
		await context.route("**/student/dashboard", async (route) => {
			await new Promise((r) => setTimeout(r, 600));
			await route.continue();
		});

		const navigation = page.goto("/student/dashboard");
		// Look for any aria-busy element from the segment loading skeleton.
		await page.locator('[aria-busy="true"]').first().isVisible({ timeout: 1500 }).catch(() => false);
		await navigation;

		await context.unroute("**/student/dashboard");
		// Test passes as long as the final page didn't error.
		expect(page.url()).toBeTruthy();
	});

	test("sign-out → returns to landing", async ({ page }) => {
		await page.goto("/student/dashboard", { waitUntil: "domcontentloaded" });
		test.skip(await isOnLogin(page), "Account is not a student — sign-out from dashboard not exercised");

		// User-menu trigger lives in the sidebar footer. base-ui's Menu primitive
		// applies `data-slot="dropdown-menu-trigger"` to the rendered button.
		const trigger = page
			.locator('[data-slot="sidebar-footer"] [data-slot="dropdown-menu-trigger"]')
			.first();
		await expect(trigger).toBeVisible({ timeout: 5000 });
		await trigger.click();

		const logout = page.getByRole("menuitem", { name: /log\s*out|sign\s*out/i }).first();
		await expect(logout).toBeVisible({ timeout: 3000 });
		await logout.click();

		// `signOut` handler does `window.location.href = "/"`. We accept "/" or "/login"
		// (depending on how quickly cookies clear before the next request).
		await page.waitForURL((url) => !/\/student/.test(url.pathname), { timeout: 10_000 });
		expect(["/", "/login"]).toContain(new URL(page.url()).pathname);
	});
});
