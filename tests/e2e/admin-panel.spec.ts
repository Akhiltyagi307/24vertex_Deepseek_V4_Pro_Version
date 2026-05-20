import { test, expect } from "@playwright/test";

import { loginAsAdmin } from "./admin-auth.helpers";

test("admin login page renders", async ({ page }) => {
	await page.goto("/admin/login");
	await expect(page.getByRole("heading", { name: /operator sign in/i })).toBeVisible();
});

/** Match `playwright.config.ts` (localhost → 127.0.0.1) for APIRequestContext. */
function apiBase(): string {
	const raw = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
	try {
		const u = new URL(raw);
		if (u.hostname === "localhost") u.hostname = "127.0.0.1";
		return u.origin + (u.pathname === "/" ? "" : u.pathname);
	} catch {
		return raw;
	}
}

test.describe("Admin API smoke (requires env)", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL ||
				!process.env.PLAYWRIGHT_ADMIN_PASSWORD ||
				!process.env.PLAYWRIGHT_E2E_TARGET_USER_ID,
			"Set PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD, PLAYWRIGHT_E2E_TARGET_USER_ID to run",
		);
	});

	test("impersonate returns magic link", async ({ request }) => {
		const base = apiBase();
		const login = await request.post(`${base}/api/admin/auth/login`, {
			data: {
				email: process.env.PLAYWRIGHT_ADMIN_EMAIL,
				password: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			},
		});
		expect(login.ok()).toBeTruthy();

		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;
		const imp = await request.post(`${base}/api/admin/users/${userId}/impersonate`);
		expect(imp.ok()).toBeTruthy();
		const body = (await imp.json()) as { magic_link?: string };
		expect(body.magic_link).toMatch(/^https?:\/\//);
	});

	test("suspend toggles (then unsuspends)", async ({ request }) => {
		const base = apiBase();
		const login = await request.post(`${base}/api/admin/auth/login`, {
			data: {
				email: process.env.PLAYWRIGHT_ADMIN_EMAIL,
				password: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			},
		});
		expect(login.ok()).toBeTruthy();
		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;

		const sus = await request.post(`${base}/api/admin/users/${userId}/suspend`, {
			data: { reason: "playwright smoke" },
		});
		expect(sus.ok()).toBeTruthy();

		const uns = await request.post(`${base}/api/admin/users/${userId}/unsuspend`);
		expect(uns.ok()).toBeTruthy();
	});
});

test.describe("Admin L2 user 360 (browser, requires env)", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL ||
				!process.env.PLAYWRIGHT_ADMIN_PASSWORD ||
				!process.env.PLAYWRIGHT_E2E_TARGET_USER_ID,
			"Set PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD, PLAYWRIGHT_E2E_TARGET_USER_ID to run",
		);
	});

	test("tests tab loads for target user", async ({ page }) => {
		await loginAsAdmin(page);
		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;
		await page.goto(`/admin/users/${userId}?tab=tests`);
		await expect(page.getByText(/Practice tests for this student/i)).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole("table")).toBeVisible();
	});

	test("open test detail when at least one test exists", async ({ page }) => {
		await loginAsAdmin(page);
		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;
		await page.goto(`/admin/users/${userId}?tab=tests`);
		await expect(page.getByText(/Practice tests for this student/i)).toBeVisible({ timeout: 30_000 });

		const testLinks = page.locator('a[href^="/admin/assessments/tests/"]');
		const n = await testLinks.count();
		if (n === 0) {
			await expect(page.getByText(/No tests/i)).toBeVisible();
			return;
		}
		await testLinks.first().click();
		await expect(page.getByRole("heading", { name: /test detail/i })).toBeVisible({ timeout: 30_000 });
	});

	test("assignments tab shows submissions copy for student target", async ({ page }) => {
		await loginAsAdmin(page);
		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;
		await page.goto(`/admin/users/${userId}?tab=assignments`);
		await expect(page.getByRole("table")).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(/Submissions for this student|No assignment data|Assignments created by this teacher/i)).toBeVisible();
	});

	test("notifications tab loads table", async ({ page }) => {
		await loginAsAdmin(page);
		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;
		await page.goto(`/admin/users/${userId}?tab=notifications`);
		await expect(page.getByText(/In-app notifications/i)).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole("table")).toBeVisible();
	});

	test("performance tab shows tracker link for student target", async ({ page }) => {
		await loginAsAdmin(page);
		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;
		await page.goto(`/admin/users/${userId}?tab=performance`);
		const tracker = page.getByRole("link", { name: /open performance tracker/i });
		const noStudent = page.getByText(/Performance tracker applies to students/i);
		await expect(tracker.or(noStudent)).toBeVisible({ timeout: 30_000 });
		if (await tracker.isVisible()) {
			await expect(tracker).toHaveAttribute("href", new RegExp(`student=${userId}`));
		}
	});

	test("audit log accepts targetId filter", async ({ page }) => {
		await loginAsAdmin(page);
		const userId = process.env.PLAYWRIGHT_E2E_TARGET_USER_ID!;
		await page.goto(`/admin/audit?targetId=${encodeURIComponent(userId)}`);
		await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(new RegExp(`target_id=${userId}`))).toBeVisible();
		await expect(page.getByRole("table")).toBeVisible();
	});
});

test.describe("Phase 5 comms & AI (browser, requires admin env)", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			"Set PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD to run",
		);
	});

	test("communications, AI, and analytics pages load", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/communications/broadcasts");
		await expect(page.getByRole("heading", { name: /broadcasts/i })).toBeVisible({ timeout: 30_000 });
		await page.goto("/admin/communications/email-log");
		await expect(page.getByRole("heading", { name: /email log/i })).toBeVisible();
		await page.goto("/admin/communications/templates");
		await expect(page.getByRole("heading", { name: /email templates/i })).toBeVisible();
		await page.goto("/admin/ai/prompts");
		await expect(page.getByRole("heading", { name: /ai prompts/i })).toBeVisible();
		await page.goto("/admin/ai/usage");
		await expect(page.getByRole("heading", { name: /ai usage/i })).toBeVisible();
		await page.goto("/admin/analytics/overview");
		await expect(page.getByRole("heading", { name: /analytics overview/i })).toBeVisible();
	});
});

test.describe("Phase 6 search & SQL API (requires admin env)", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			"Set PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD to run",
		);
	});

	test("global search validates q length", async ({ request }) => {
		const base = apiBase();
		const login = await request.post(`${base}/api/admin/auth/login`, {
			data: {
				email: process.env.PLAYWRIGHT_ADMIN_EMAIL,
				password: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			},
		});
		expect(login.ok()).toBeTruthy();

		const short = await request.get(`${base}/api/admin/search?q=a`);
		expect(short.status()).toBe(400);

		const ok = await request.get(`${base}/api/admin/search?q=ab`);
		expect(ok.ok()).toBeTruthy();
		const body = (await ok.json()) as { data?: unknown };
		expect(Array.isArray(body.data)).toBe(true);
	});

	test("SQL console run rejects UPDATE", async ({ request }) => {
		const base = apiBase();
		const login = await request.post(`${base}/api/admin/auth/login`, {
			data: {
				email: process.env.PLAYWRIGHT_ADMIN_EMAIL,
				password: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			},
		});
		expect(login.ok()).toBeTruthy();

		const bad = await request.post(`${base}/api/admin/system/sql/run`, {
			data: { sql: "UPDATE admin_sessions SET revoked_at = now() WHERE false", writable: false },
		});
		expect(bad.status()).toBe(400);

		const good = await request.post(`${base}/api/admin/system/sql/run`, {
			data: { sql: "SELECT 1 AS n", writable: false },
		});
		expect(good.ok()).toBeTruthy();
		const payload = (await good.json()) as { data?: { rows?: unknown[] } };
		expect(payload.data?.rows?.length).toBeGreaterThanOrEqual(1);
	});
});

test.describe("Phase 6 command palette (browser, requires admin env)", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			"Set PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD to run",
		);
	});

	test("palette shows Actions including broadcast compose", async ({ page }) => {
		await loginAsAdmin(page);
		await page.keyboard.press("Control+KeyK");
		await expect(page.getByRole("dialog", { name: /command palette/i })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText("Open broadcast compose")).toBeVisible();
		await expect(page.getByText("Kill all other admin sessions")).toBeVisible();
	});
});

// Dedicated panic flow moved to `admin-panic.spec.ts` per D34. The existing
// suite intentionally no longer includes the panic call so unrelated admin
// smoke tests aren't gated on PLAYWRIGHT_PANIC_TOKEN / PLAYWRIGHT_PANIC_TOTP.
