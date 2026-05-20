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

	// D7: CIDR + IPv6 support
	describe("D7: CIDR and IPv6 matching", () => {
		it("matches IPv4 inside a /24 CIDR", () => {
			process.env.ADMIN_IP_ALLOWLIST = "203.0.113.0/24";
			expect(isAdminIpAllowed("203.0.113.1")).toBe(true);
			expect(isAdminIpAllowed("203.0.113.255")).toBe(true);
			expect(isAdminIpAllowed("203.0.114.1")).toBe(false);
		});

		it("matches IPv4 inside a /8 CIDR and rejects outside", () => {
			process.env.ADMIN_IP_ALLOWLIST = "10.0.0.0/8";
			expect(isAdminIpAllowed("10.1.2.3")).toBe(true);
			expect(isAdminIpAllowed("11.0.0.0")).toBe(false);
		});

		it("matches exact IPv6", () => {
			process.env.ADMIN_IP_ALLOWLIST = "2001:db8::1";
			expect(isAdminIpAllowed("2001:db8::1")).toBe(true);
			expect(isAdminIpAllowed("2001:db8::2")).toBe(false);
		});

		it("matches IPv6 inside a /32 CIDR", () => {
			process.env.ADMIN_IP_ALLOWLIST = "2001:db8::/32";
			expect(isAdminIpAllowed("2001:db8::1")).toBe(true);
			expect(isAdminIpAllowed("2001:db8:ffff::1")).toBe(true);
			expect(isAdminIpAllowed("2001:db9::1")).toBe(false);
		});

		it("normalizes IPv6 case + zero-run forms", () => {
			process.env.ADMIN_IP_ALLOWLIST = "2001:0DB8:0:0:0:0:0:1";
			expect(isAdminIpAllowed("2001:db8::1")).toBe(true);
			expect(isAdminIpAllowed("2001:DB8::1")).toBe(true);
		});

		it("treats IPv4-mapped IPv6 ::ffff:a.b.c.d as IPv4", () => {
			process.env.ADMIN_IP_ALLOWLIST = "203.0.113.0/24";
			expect(isAdminIpAllowed("::ffff:203.0.113.1")).toBe(true);
			expect(isAdminIpAllowed("::ffff:198.51.100.1")).toBe(false);
		});

		it("mixes exact + CIDR + IPv6 entries", () => {
			process.env.ADMIN_IP_ALLOWLIST = "10.0.0.1, 192.168.0.0/16, 2001:db8::1";
			expect(isAdminIpAllowed("10.0.0.1")).toBe(true);
			expect(isAdminIpAllowed("10.0.0.2")).toBe(false);
			expect(isAdminIpAllowed("192.168.42.7")).toBe(true);
			expect(isAdminIpAllowed("172.16.0.1")).toBe(false);
			expect(isAdminIpAllowed("2001:db8::1")).toBe(true);
			expect(isAdminIpAllowed("2001:db8::2")).toBe(false);
		});

		it("rejects malformed CIDR or IP gracefully (no match, no throw)", () => {
			process.env.ADMIN_IP_ALLOWLIST = "not-an-ip, 999.999.999.999, 10.0.0.0/40";
			expect(isAdminIpAllowed("10.0.0.1")).toBe(false);
			expect(() => isAdminIpAllowed("malformed!")).not.toThrow();
		});

		it("kind mismatch never matches (v4 entry, v6 request and vice versa)", () => {
			process.env.ADMIN_IP_ALLOWLIST = "203.0.113.0/24";
			expect(isAdminIpAllowed("2001:db8::1")).toBe(false);

			process.env.ADMIN_IP_ALLOWLIST = "2001:db8::/32";
			expect(isAdminIpAllowed("203.0.113.1")).toBe(false);
		});
	});
});
