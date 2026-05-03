import { describe, expect, it } from "vitest";

import { clientIpForPostgresInet } from "@/lib/admin/ip-sanitize";

describe("clientIpForPostgresInet", () => {
	it("returns null for empty, unknown, and zero", () => {
		expect(clientIpForPostgresInet(null)).toBeNull();
		expect(clientIpForPostgresInet("")).toBeNull();
		expect(clientIpForPostgresInet("  ")).toBeNull();
		expect(clientIpForPostgresInet("0.0.0.0")).toBeNull();
	});

	it("rejects junk that would break Postgres inet", () => {
		expect(clientIpForPostgresInet("unknown")).toBeNull();
		expect(clientIpForPostgresInet("not-an-ip")).toBeNull();
	});

	it("accepts IPv4 and IPv6", () => {
		expect(clientIpForPostgresInet("106.219.157.207")).toBe("106.219.157.207");
		expect(clientIpForPostgresInet("2001:db8::1")).toBe("2001:db8::1");
	});
});
