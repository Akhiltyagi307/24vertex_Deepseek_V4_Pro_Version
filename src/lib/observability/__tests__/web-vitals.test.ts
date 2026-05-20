import { describe, expect, it } from "vitest";

import { __test_routeTagFromPathname as routeTag } from "@/lib/observability/web-vitals";

describe("routeTagFromPathname (web-vitals)", () => {
	it("tags the marketing landing as public/landing", () => {
		expect(routeTag("/")).toBe("public/landing");
	});

	it("preserves portal routes", () => {
		expect(routeTag("/student/dashboard")).toBe("/student/dashboard");
		expect(routeTag("/admin/users")).toBe("/admin/users");
		expect(routeTag("/teacher/assignments")).toBe("/teacher/assignments");
		expect(routeTag("/parent/dashboard")).toBe("/parent/dashboard");
	});

	it("tags legal pages under public/legal/<slug>", () => {
		expect(routeTag("/legal/privacy")).toBe("public/legal/privacy");
		expect(routeTag("/legal/terms")).toBe("public/legal/terms");
		expect(routeTag("/legal/refund")).toBe("public/legal/refund");
		expect(routeTag("/legal/shipping")).toBe("public/legal/shipping");
	});

	it("tags bare /legal as public/legal", () => {
		expect(routeTag("/legal")).toBe("public/legal");
		expect(routeTag("/legal/")).toBe("public/legal");
	});

	it("collapses UUIDs to :id", () => {
		expect(routeTag("/student/practice/00000000-0000-0000-0000-000000000001")).toBe(
			"/student/practice/:id",
		);
		expect(routeTag("/admin/users/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/edit")).toBe(
			"/admin/users/:id/edit",
		);
	});

	it("collapses bare integers in portal routes to :id", () => {
		expect(routeTag("/admin/users/12")).toBe("/admin/users/:id");
		expect(routeTag("/teacher/assignments/42/edit")).toBe("/teacher/assignments/:id/edit");
	});

	it("collapses XX#### parent link codes to :code", () => {
		expect(routeTag("/parent/link-child/AB1234")).toBe("/parent/link-child/:code");
	});

	it("collapses long opaque tokens to :token", () => {
		expect(routeTag("/auth/reset-password/abcdef0123456789ABCDEF0123456789xyz")).toBe(
			"/auth/reset-password/:token",
		);
	});

	it("returns '/' for empty input (SSR fallback)", () => {
		expect(routeTag("")).toBe("/");
	});

	it("does not over-collapse normal portal segments", () => {
		// `assignments` is 11 chars — must not be confused with a token.
		expect(routeTag("/teacher/assignments/new")).toBe("/teacher/assignments/new");
	});
});
