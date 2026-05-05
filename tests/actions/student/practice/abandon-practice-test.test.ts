/**
 * Server-action tests for `abandonPracticeTest`.
 *
 * What's covered:
 *   - Invalid payload (non-UUID testId) → ok:false
 *   - RPC error → ok:false with friendly message
 *   - Happy path → ok:true
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const { mockSupabase } = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	logServerError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));

import { abandonPracticeTest } from "@/app/student/practice/actions/abandon-practice-test";

const VALID_TEST_ID = "00000000-0000-0000-0000-000000000010";

beforeEach(() => {
	mockSupabase.current = makeMockSupabase({
		rpcs: { practice_abandon_test: { data: null, error: null } },
	});
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("abandonPracticeTest", () => {
	it("rejects a non-UUID testId", async () => {
		const out = await abandonPracticeTest({ testId: "not-a-uuid" });
		expect(out).toEqual({ ok: false, message: expect.any(String) });
	});

	it("rejects a missing testId", async () => {
		const out = await abandonPracticeTest({});
		expect(out).toEqual({ ok: false, message: expect.any(String) });
	});

	it("returns ok:false when the RPC errors", async () => {
		mockSupabase.current = makeMockSupabase({
			rpcs: { practice_abandon_test: { error: { message: "boom" } } },
		});
		const out = await abandonPracticeTest({ testId: VALID_TEST_ID });
		expect(out).toEqual({ ok: false, message: expect.stringMatching(/abandon/i) });
	});

	it("returns ok on the happy path", async () => {
		const out = await abandonPracticeTest({ testId: VALID_TEST_ID });
		expect(out).toEqual({ ok: true });
	});
});
