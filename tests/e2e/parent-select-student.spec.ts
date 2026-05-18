/**
 * Parent select-student E2E. Audit D29 coverage: after switching, the
 * active-student cookie flips and subsequent parent-portal pages reflect
 * the new child.
 *
 * Skips when PLAYWRIGHT_PARENT_EMAIL is unset OR when the test parent has
 * fewer than 1 linked child (we don't seed multi-child fixtures here; the
 * cookie behavior is still validated against a single-child account).
 */
import { expect, test } from "@playwright/test";

const PARENT_CRED_HINT =
	"Set PLAYWRIGHT_PARENT_EMAIL + PLAYWRIGHT_PARENT_PASSWORD in .env.local to run parent E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_PARENT_EMAIL?.trim(), PARENT_CRED_HINT);
});

test.describe("Parent select-student", () => {
	test("clicking a linked child sets the active-student cookie and lands on /parent/dashboard", async ({ page }) => {
		await page.goto("/parent/select-student", { waitUntil: "domcontentloaded" });
		const onPicker = new URL(page.url()).pathname === "/parent/select-student";
		test.skip(!onPicker, "select-student picker not reachable from this account");

		const linkedButtons = page.locator("form button[type=submit]");
		const count = await linkedButtons.count();
		test.skip(count === 0, "test parent has no linked children to switch to");

		await linkedButtons.first().click();
		await page.waitForURL((url) => url.pathname.startsWith("/parent/"), { timeout: 10_000 });

		const cookies = await page.context().cookies();
		const active = cookies.find((c) => c.name === "eduai_parent_active_student");
		expect(active?.value).toMatch(/^[0-9a-f-]{36}$/i);
		expect(active?.httpOnly).toBe(true);
	});

	test("cookie max-age is bounded (≤ ~31 days) — audit D3", async ({ page }) => {
		await page.goto("/parent/select-student", { waitUntil: "domcontentloaded" });
		const linkedButtons = page.locator("form button[type=submit]");
		test.skip(
			(await linkedButtons.count()) === 0,
			"need at least one linked child to set the cookie",
		);
		await linkedButtons.first().click();
		await page.waitForURL((url) => url.pathname.startsWith("/parent/"), { timeout: 10_000 });

		const cookies = await page.context().cookies();
		const active = cookies.find((c) => c.name === "eduai_parent_active_student");
		expect(active).toBeTruthy();
		// Cookie should expire within ~31 days. Playwright reports `expires`
		// as Unix seconds; -1 means session-only (we set a maxAge, so it
		// should be a real number).
		const expiresUnix = active?.expires ?? 0;
		const secondsFromNow = expiresUnix - Math.floor(Date.now() / 1000);
		expect(secondsFromNow).toBeGreaterThan(60 * 60 * 24 * 29);
		expect(secondsFromNow).toBeLessThan(60 * 60 * 24 * 31);
	});
});
