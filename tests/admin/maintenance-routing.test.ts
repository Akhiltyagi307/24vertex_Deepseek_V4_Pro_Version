import { describe, expect, it } from "vitest";

import { shouldRedirectToMaintenance } from "@/lib/admin/maintenance-routing";

describe("shouldRedirectToMaintenance", () => {
	it("returns false when maintenance mode is off", () => {
		expect(shouldRedirectToMaintenance("/student/dashboard", undefined)).toBe(false);
		expect(shouldRedirectToMaintenance("/student/dashboard", "false")).toBe(false);
		expect(shouldRedirectToMaintenance("/student/dashboard", "")).toBe(false);
	});

	it("never redirects admin HTML paths when maintenance is on", () => {
		expect(shouldRedirectToMaintenance("/admin/dashboard", "true")).toBe(false);
		expect(shouldRedirectToMaintenance("/admin/login", "true")).toBe(false);
		expect(shouldRedirectToMaintenance("/admin/users/students", "true")).toBe(false);
	});

	it("never redirects admin API paths when maintenance is on", () => {
		expect(shouldRedirectToMaintenance("/api/admin/audit", "true")).toBe(false);
		expect(shouldRedirectToMaintenance("/api/admin/auth/login", "true")).toBe(false);
	});

	it("redirects non-admin paths when maintenance is on", () => {
		expect(shouldRedirectToMaintenance("/student/dashboard", "true")).toBe(true);
		expect(shouldRedirectToMaintenance("/", "true")).toBe(true);
		expect(shouldRedirectToMaintenance("/login", "true")).toBe(true);
	});

	it("does not redirect when already on /maintenance", () => {
		expect(shouldRedirectToMaintenance("/maintenance", "true")).toBe(false);
		expect(shouldRedirectToMaintenance("/maintenance/foo", "true")).toBe(false);
	});
});
