import { describe, expect, it } from "vitest";

import { truncateForAdminPreview } from "@/lib/admin/user-detail-lists";

describe("truncateForAdminPreview", () => {
	it("returns short text unchanged", () => {
		expect(truncateForAdminPreview("hello", 10)).toBe("hello");
	});

	it("collapses whitespace", () => {
		expect(truncateForAdminPreview("a  \n b", 10)).toBe("a b");
	});

	it("truncates with ellipsis", () => {
		expect(truncateForAdminPreview("0123456789abc", 10)).toBe("0123456789…");
	});
});
