import { describe, expect, it } from "vitest";

import india from "@svg-maps/india";

/**
 * `@svg-maps/india` ships one large `index.js` with `export default { ... }` (ESM syntax).
 * Unlike `smiles-drawer`, it does not ship raw TypeScript — Next parses it without
 * `transpilePackages`. Full bundling is verified by `pnpm exec next build` in CI / locally.
 */
describe("@svg-maps/india", () => {
	it("exposes viewBox and locations for india_map renderers", () => {
		expect(india.label).toBeTruthy();
		expect(typeof india.viewBox).toBe("string");
		expect(india.viewBox.trim().length).toBeGreaterThan(0);
		expect(Array.isArray(india.locations)).toBe(true);
		expect(india.locations.length).toBe(36);
		const first = india.locations[0];
		expect(first).toMatchObject({
			id: expect.any(String),
			name: expect.any(String),
			path: expect.any(String),
		});
	});
});
