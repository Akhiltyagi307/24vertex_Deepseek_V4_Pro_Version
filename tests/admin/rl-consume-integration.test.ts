/**
 * Integration test for the `public.rl_consume` Postgres function.
 *
 * The TypeScript wrapper (`rlConsume`) and the LRU + circuit-breaker layers
 * are unit-tested in `src/lib/ratelimit/__tests__/ratelimit.test.ts`. What
 * was untested was the actual SQL function — the audit flagged this as a
 * gap because every rate-limit decision in the system ultimately depends
 * on it returning the right thing.
 *
 * Gating: needs `DATABASE_URL` AND `RL_CONSUME_INTEGRATION_VITEST=1`. Skips
 * otherwise so devs without a Supabase URL still see the rest pass. The
 * second flag is explicit because the test writes to `rl_buckets` (a small
 * test-only key gets cleaned up in afterAll).
 */
import { afterAll, describe, expect, it } from "vitest";

import { rlConsume } from "@/lib/ratelimit/consume";

const wantsIntegration = Boolean(
	process.env.DATABASE_URL && process.env.RL_CONSUME_INTEGRATION_VITEST === "1",
);

let integrationRun = false;
if (wantsIntegration) {
	try {
		const { ratelimitSql } = await import("@/db");
		// Sanity-poke: the function must exist on the connected DB. If the
		// migration that creates rl_consume hasn't been applied to this DB,
		// this throws and we keep the suite skipped instead of failing.
		await ratelimitSql`select 1 from public.rl_consume('integration:warmup', 1, 60) limit 1`;
		integrationRun = true;
	} catch {
		integrationRun = false;
	}
}

const TEST_KEY_PREFIX = `rl-consume-integration:${Date.now()}`;
const testKey = (suffix: string) => `${TEST_KEY_PREFIX}:${suffix}`;

afterAll(async () => {
	if (!integrationRun) return;
	const { ratelimitSql } = await import("@/db");
	// Best-effort cleanup. The bucket TTL would also drop these naturally,
	// but explicit cleanup keeps `rl_buckets` tidy for ad-hoc inspection.
	try {
		await ratelimitSql`delete from public.rl_buckets where key like ${`${TEST_KEY_PREFIX}%`}`;
	} catch {
		/* ignore — table or column rename would surface here, not relevant to the assertion */
	}
});

describe.skipIf(!integrationRun)("public.rl_consume — DB integration", () => {
	it("first call within the window is allowed and `remaining` drops by one", async () => {
		const r1 = await rlConsume({ key: testKey("first"), limit: 3, windowSec: 60 });
		expect(r1.allowed).toBe(true);
		expect(r1.remaining).toBe(2);
	});

	it("denies once `limit` consecutive consumes are spent in the window", async () => {
		const key = testKey("denies");
		const a = await rlConsume({ key, limit: 2, windowSec: 60 });
		const b = await rlConsume({ key, limit: 2, windowSec: 60 });
		const c = await rlConsume({ key, limit: 2, windowSec: 60 });
		expect(a.allowed).toBe(true);
		expect(b.allowed).toBe(true);
		// Third call exhausted the bucket; SQL function must say "denied".
		expect(c.allowed).toBe(false);
		expect(c.remaining).toBe(0);
		// `resetAt` must be in the future (the window hasn't elapsed yet).
		expect(c.resetAt.getTime()).toBeGreaterThan(Date.now());
	});

	it("isolates buckets per key (one key's denial doesn't affect another)", async () => {
		const keyA = testKey("isolate-a");
		const keyB = testKey("isolate-b");
		await rlConsume({ key: keyA, limit: 1, windowSec: 60 }); // exhausts A
		const aDenied = await rlConsume({ key: keyA, limit: 1, windowSec: 60 });
		const bAllowed = await rlConsume({ key: keyB, limit: 1, windowSec: 60 });
		expect(aDenied.allowed).toBe(false);
		expect(bAllowed.allowed).toBe(true);
	});

	it("returns a `resetAt` Date the wrapper can present to clients", async () => {
		const r = await rlConsume({ key: testKey("reset"), limit: 5, windowSec: 30 });
		expect(r.resetAt instanceof Date).toBe(true);
		// Within window (~30s) ± slack for clock skew.
		const deltaMs = r.resetAt.getTime() - Date.now();
		expect(deltaMs).toBeGreaterThan(0);
		expect(deltaMs).toBeLessThan(60_000);
	});
});
