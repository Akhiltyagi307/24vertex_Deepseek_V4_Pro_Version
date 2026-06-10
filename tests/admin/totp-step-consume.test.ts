import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * M2: single-use (anti-replay) TOTP step compare-and-set. `db` is mocked so we
 * assert the accept/replay/fail-open semantics without a live `admin_runtime_kv`.
 */

const returning = vi.fn();
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate }));
const insert = vi.fn(() => ({ values }));

vi.mock("@/db", () => ({ db: { insert } }));

describe("tryConsumeAdminTotpStep (M2)", () => {
	afterEach(() => vi.clearAllMocks());

	it("accepts a fresh step, rejects an already-consumed one, fails open on DB error", async () => {
		const { tryConsumeAdminTotpStep } = await import("@/lib/admin/runtime-pg");

		// Fresh step: the conditional upsert advances the stored value → row returned.
		returning.mockResolvedValueOnce([{ valueInt: 1000 }]);
		expect(await tryConsumeAdminTotpStep(1000)).toBe(true);

		// Same step again: setWhere (stored < step) is false → no row updated → replay.
		returning.mockResolvedValueOnce([]);
		expect(await tryConsumeAdminTotpStep(1000)).toBe(false);

		// DB error: fail OPEN (true) so a KV/DB outage can't lock admins out.
		returning.mockRejectedValueOnce(new Error("db down"));
		expect(await tryConsumeAdminTotpStep(1001)).toBe(true);
	});
});
