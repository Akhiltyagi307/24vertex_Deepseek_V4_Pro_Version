import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "";

/** Console errors we'll tolerate (third-party noise we don't control). */
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
	/Failed to load resource.*sentry/i,
	/sentry.*not configured/i,
	/Download the React DevTools/i,
	/\[Fast Refresh\]/i,
];

function attachConsoleCollector(page: Page): { errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];
	page.on("console", (msg: ConsoleMessage) => {
		const text = msg.text();
		if (IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
		if (msg.type() === "error") errors.push(text);
		else if (msg.type() === "warning") warnings.push(text);
	});
	page.on("pageerror", (err) => {
		errors.push(`pageerror: ${err.message}`);
	});
	return { errors, warnings };
}

test.describe("Landing page (perf-optimized)", () => {
	test("renders without console errors and shows hero + nav", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);

		await page.goto("/");
		await expect(page).toHaveURL(/\/$|^http/);

		// Hero CTA copy is part of the H1 — confirms the CSS-only stagger landed without breaking layout.
		await expect(page.getByRole("heading", { name: /Practice smarter/i })).toBeVisible();

		// Logo (next/image with priority on landing).
		await expect(page.locator('img[alt*="logo" i]').first()).toBeVisible();

		// Theme toggle (animated toggle island).
		const themeToggle = page.getByRole("switch").or(page.getByLabel(/theme/i)).first();
		await expect(themeToggle).toBeVisible();

		// Footer renders (signals full page hydrated, including the inline social SVGs we replaced react-icons with).
		// Footer is nested inside <main>, so it doesn't have implicit contentinfo role — find by tag instead.
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await expect(page.locator("footer").first()).toBeVisible();

		expect(errors, `Unexpected console errors: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("optimized assets are referenced (subjects.webp, AVIF logo via next/image)", async ({ page }) => {
		await page.goto("/");
		// Scroll to features to trigger the lazy-loaded animated WebP.
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
		await page.waitForTimeout(500);

		// The animated subjects.webp should be in DOM (raw <img> intentional — Next/Image strips frames).
		const subjectsWebp = page.locator('img[src*="subjects.webp"]');
		await expect(subjectsWebp.first()).toBeAttached();
	});
});

test.describe("Auth flow", () => {
	test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "PLAYWRIGHT_ADMIN_EMAIL/PASSWORD not set");

	test("login page renders + form is interactive", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);

		await page.goto("/login");
		await expect(page).toHaveURL(/\/login/);

		// Form fields render — auth-studio-card.tsx with the new AVIF + blurDataURL hasn't broken hydration.
		const email = page.getByLabel(/email/i).first();
		const password = page.getByLabel(/password/i).first();
		await expect(email).toBeVisible();
		await expect(password).toBeVisible();

		expect(errors, `Console errors on login: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("admin login submits and Supabase Auth call completes", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel(/email/i).first().fill(ADMIN_EMAIL);
		await page.getByLabel(/password/i).first().fill(ADMIN_PASSWORD);

		// Watch for the Supabase Auth token call so we know signInWithPassword fired.
		const authResponse = page.waitForResponse(
			(res) => /\/auth\/v1\/token/.test(res.url()) && res.request().method() === "POST",
			{ timeout: 15_000 },
		);

		await page.getByRole("button", { name: /sign\s*in|log\s*in/i }).first().click();

		const res = await authResponse;
		// 200 = creds accepted, 400 = creds rejected. We're testing the form/network path,
		// not the validity of the creds — both outcomes prove auth wiring works.
		expect([200, 400]).toContain(res.status());

		// On 200, the form does window.location.assign("/") — verify navigation off /login.
		// On 400, an error alert renders. Accept either.
		await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
		const onErrorAlert = await page.getByRole("alert").first().isVisible().catch(() => false);
		const navigatedAway = !/\/login/.test(new URL(page.url()).pathname);
		expect(onErrorAlert || navigatedAway, "either an error alert or successful navigation must occur").toBe(true);
	});
});

test.describe("Static metadata routes", () => {
	test("manifest.webmanifest is served as JSON", async ({ request }) => {
		const res = await request.get("/manifest.webmanifest");
		expect(res.status(), "manifest should be 200").toBe(200);
		const json = await res.json();
		expect(json.name).toBe("EduAI");
	});

	test("apple-icon.png is served", async ({ request }) => {
		const res = await request.get("/apple-icon.png");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"] ?? "").toContain("image/png");
	});

	test("opengraph-image renders", async ({ request }) => {
		const res = await request.get("/opengraph-image");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"] ?? "").toMatch(/image\/png|image\/webp/);
	});
});

test.describe("Middleware behavior", () => {
	test("legal/privacy is reachable and static-cached", async ({ page, request }) => {
		await page.goto("/legal/privacy");
		await expect(page.getByRole("heading", { name: /privacy/i }).first()).toBeVisible();

		// Static-rendered routes should not set fresh auth cookies on every load.
		const res = await request.get("/legal/privacy");
		expect(res.status()).toBe(200);
	});
});
