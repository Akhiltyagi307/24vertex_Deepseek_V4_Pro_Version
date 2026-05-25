import { describe, expect, it } from "vitest";

import { isPublicMarketingCspPath } from "@/lib/security/public-csp-paths";

describe("isPublicMarketingCspPath", () => {
	it("includes the landing page and legal subtree", () => {
		expect(isPublicMarketingCspPath("/")).toBe(true);
		expect(isPublicMarketingCspPath("/legal/privacy")).toBe(true);
		expect(isPublicMarketingCspPath("/legal/privacy/")).toBe(true);
	});

	it("includes marketing routes", () => {
		expect(isPublicMarketingCspPath("/pricing")).toBe(true);
		expect(isPublicMarketingCspPath("/blog/my-post")).toBe(true);
		expect(isPublicMarketingCspPath("/boards/cbse")).toBe(true);
	});

	it("excludes auth and portal prefixes", () => {
		expect(isPublicMarketingCspPath("/login")).toBe(false);
		expect(isPublicMarketingCspPath("/signup/student")).toBe(false);
		expect(isPublicMarketingCspPath("/student/dashboard")).toBe(false);
		expect(isPublicMarketingCspPath("/parent/dashboard")).toBe(false);
		expect(isPublicMarketingCspPath("/teacher/dashboard")).toBe(false);
		expect(isPublicMarketingCspPath("/admin/login")).toBe(false);
		expect(isPublicMarketingCspPath("/api/student/notifications")).toBe(false);
	});

	it("includes dev marketing preview routes", () => {
		expect(isPublicMarketingCspPath("/dev/marketing")).toBe(true);
	});
});
