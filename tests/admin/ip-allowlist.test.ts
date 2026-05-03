import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isAdminIpAllowed } from "@/lib/admin/ip-allowlist";

describe("isAdminIpAllowed", () => {
	const prev = { ...process.env };

	beforeEach(() => {
		process.env = { ...prev };
		vi.unstubAllEnvs();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		process.env = { ...prev };
	});

	it("allows any IP when allowlist unset", () => {
		delete process.env.ADMIN_IP_ALLOWLIST;
		expect(isAdminIpAllowed("203.0.113.1")).toBe(true);
		expect(isAdminIpAllowed("0.0.0.0")).toBe(true);
	});

	it("denies IP not on allowlist", () => {
		process.env.ADMIN_IP_ALLOWLIST = "203.0.113.1";
		delete process.env.ADMIN_LOGIN_ALLOW_UNKNOWN_IP;
		expect(isAdminIpAllowed("198.51.100.5")).toBe(false);
		expect(isAdminIpAllowed("203.0.113.1")).toBe(true);
	});

	it("denies 0.0.0.0 in production when allowlist set without ADMIN_LOGIN_ALLOW_UNKNOWN_IP", () => {
		vi.stubEnv("NODE_ENV", "production");
		process.env.ADMIN_IP_ALLOWLIST = "203.0.113.1";
		delete process.env.ADMIN_LOGIN_ALLOW_UNKNOWN_IP;
		expect(isAdminIpAllowed("0.0.0.0")).toBe(false);
	});

	it("allows 0.0.0.0 in production when ADMIN_LOGIN_ALLOW_UNKNOWN_IP=1", () => {
		vi.stubEnv("NODE_ENV", "production");
		process.env.ADMIN_IP_ALLOWLIST = "203.0.113.1";
		process.env.ADMIN_LOGIN_ALLOW_UNKNOWN_IP = "1";
		expect(isAdminIpAllowed("0.0.0.0")).toBe(true);
	});
});
