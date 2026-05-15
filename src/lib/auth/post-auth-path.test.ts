import { describe, expect, it } from "vitest";

import { postAuthPathFromProfile } from "@/lib/auth/post-auth-path";

describe("postAuthPathFromProfile", () => {
	it("sends missing profile to role picker", () => {
		expect(postAuthPathFromProfile(null)).toBe("/signup/role-picker");
	});

	it("maps core roles", () => {
		expect(postAuthPathFromProfile({ role: "student", is_verified: true })).toBe("/student/dashboard");
		expect(postAuthPathFromProfile({ role: "parent", is_verified: true })).toBe("/parent/select-student");
		expect(postAuthPathFromProfile({ role: "teacher", is_verified: true })).toBe("/teacher/dashboard");
		expect(postAuthPathFromProfile({ role: "teacher", is_verified: false })).toBe("/teacher/pending");
		expect(postAuthPathFromProfile({ role: "teacher", is_verified: null })).toBe("/teacher/pending");
		expect(postAuthPathFromProfile({ role: "admin", is_verified: true })).toBe("/");
	});

	it("falls back to home for unknown roles", () => {
		expect(postAuthPathFromProfile({ role: "ninja", is_verified: true })).toBe("/");
	});
});
