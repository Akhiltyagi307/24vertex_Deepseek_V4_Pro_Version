/**
 * Tests for the per-admin action rate-limit helper. The helper itself is a
 * thin wrapper over `rlConsume`; what matters is the scope key it builds (so
 * different admins don't share buckets and the same admin shares one across
 * their multiple browser tabs).
 *
 * The actual `rlConsume` behavior is covered by `tests/lib/ratelimit.test.ts`
 * (and the LRU + circuit-breaker tests) — we don't re-test it here.
 */
import { describe, expect, it } from "vitest";

import { adminActionScope } from "@/lib/admin/rate-limit-action";

describe("adminActionScope", () => {
	it("prefers jti so two admins on the same network don't share a bucket", () => {
		const a = adminActionScope({ jti: "session-a", email: "x@y", ip: "1.2.3.4" });
		const b = adminActionScope({ jti: "session-b", email: "x@y", ip: "1.2.3.4" });
		expect(a).toBe("jti:session-a");
		expect(b).toBe("jti:session-b");
		expect(a).not.toBe(b);
	});

	it("falls back to email (lowercased) when jti is absent", () => {
		expect(adminActionScope({ email: "Admin@Example.COM" })).toBe("email:admin@example.com");
	});

	it("falls back to IP when jti and email are absent, ignoring 0.0.0.0 dev sentinel", () => {
		expect(adminActionScope({ ip: "203.0.113.10" })).toBe("ip:203.0.113.10");
		expect(adminActionScope({ ip: "0.0.0.0" })).toBe("scope:unknown");
	});

	it("returns scope:unknown when nothing useful is present", () => {
		expect(adminActionScope({})).toBe("scope:unknown");
		expect(adminActionScope({ jti: "", email: "", ip: "" })).toBe("scope:unknown");
	});
});
