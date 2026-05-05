import { describe, expect, it } from "vitest";

import { __test_routeTagFromPathname as routeTag } from "@/lib/observability/web-vitals";

describe("routeTagFromPathname (web-vitals)", () => {
	it("preserves static routes", () => {
		expect(routeTag("/")).toBe("/");
		expect(routeTag("/student/dashboard")).toBe("/student/dashboard");
		expect(routeTag("/admin/users")).toBe("/admin/users");
	});

	it("collapses UUIDs to :id", () => {
		expect(routeTag("/student/practice/00000000-0000-0000-0000-000000000001")).toBe(
			"/student/practice/:id",
		);
		expect(routeTag("/admin/users/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/edit")).toBe(
			"/admin/users/:id/edit",
		);
	});

	it("collapses bare integers to :id", () => {
		expect(routeTag("/legal/version/12")).toBe("/legal/version/:id");
	});

	it("collapses XX#### parent link codes to :code", () => {
		expect(routeTag("/parent/link-child/AB1234")).toBe("/parent/link-child/:code");
	});

	it("collapses long opaque tokens to :token", () => {
		expect(routeTag("/auth/reset-password/abcdef0123456789ABCDEF0123456789xyz")).toBe(
			"/auth/reset-password/:token",
		);
	});

	it("returns '/' for empty input", () => {
		expect(routeTag("")).toBe("/");
	});
});
