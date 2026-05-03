import type { Page } from "@playwright/test";

/** Signs in via `/admin/login` using `PLAYWRIGHT_*` env vars (see `.env.example`). */
export async function loginAsAdmin(page: Page): Promise<void> {
	const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
	const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error("PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD must be set");
	}

	await page.goto("/admin/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	const totp = process.env.PLAYWRIGHT_ADMIN_TOTP?.trim();
	if (totp) {
		await page.getByLabel(/Authenticator code/i).fill(totp);
	}
	await page.getByRole("button", { name: /sign in/i }).click();
	await page.waitForURL(
		(url) => {
			const p = url.pathname;
			return p.startsWith("/admin") && p !== "/admin/login";
		},
		{ timeout: 60_000 },
	);
}
