import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression guard for review finding M12 / H5: every admin API route must call
 * requireAdminApi(). There is no central allowlist enforcing this — each route
 * remembers its own guard — so a new admin route that forgets it would be
 * reachable by anyone with the admin JWT shape until a Node guard ran. This test
 * fails CI if any admin route omits the guard.
 *
 * The only intentionally-public admin routes are the admin auth endpoints
 * themselves and panic (which uses a stronger token + step-up TOTP gate).
 */
const PUBLIC_ADMIN_ROUTES = new Set<string>([
	"auth/login/route.ts",
	"auth/logout/route.ts",
	"auth/session/route.ts",
	"panic/route.ts",
]);

const ADMIN_API_DIR = join(process.cwd(), "app/api/admin");

function walkRouteFiles(dir: string, base: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) out.push(...walkRouteFiles(abs, rel));
		else if (entry.name === "route.ts") out.push(rel);
	}
	return out;
}

describe("admin API routes enforce admin auth (M12)", () => {
	const routes = walkRouteFiles(ADMIN_API_DIR, "");

	it("discovers the admin route tree", () => {
		expect(routes.length).toBeGreaterThan(100);
	});

	for (const rel of routes) {
		const isPublic = PUBLIC_ADMIN_ROUTES.has(rel);
		it(`${rel} ${isPublic ? "is allowlisted public" : "calls requireAdminApi()"}`, () => {
			const src = readFileSync(join(ADMIN_API_DIR, rel), "utf8");
			if (isPublic) {
				expect(src).not.toMatch(/requireAdminApi\s*\(/);
			} else {
				expect(src).toMatch(/requireAdminApi\s*\(/);
			}
		});
	}
});
