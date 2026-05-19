/**
 * Server-action tests for `abandonPracticeTest`.
 *
 * What's covered:
 *   - Invalid payload (non-UUID testId) → ok:false
 *   - Unauthenticated caller → ok:false
 *   - Test owned by another student → ok:false (D9 ownership double-check)
 *   - Test not in `in_progress` status → ok:false
 *   - RPC error → ok:false with friendly message
 *   - Happy path → ok:true
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const { mockSupabase, mockUser } = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	mockUser: { current: null as null | { id: string; email?: string } },
}));

vi.mock("@/lib/auth/get-server-user", () => ({
	getServerUser: async () => mockUser.current,
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

const STUDENT_ID = "00000000-0000-0000-0000-0000000000aa";
const OTHER_STUDENT_ID = "00000000-0000-0000-0000-0000000000bb";
const VALID_TEST_ID = "00000000-0000-0000-0000-000000000010";

beforeEach(() => {
	mockUser.current = { id: STUDENT_ID };
	mockSupabase.current = makeMockSupabase({
		user: { id: STUDENT_ID },
		tables: {
			tests: {
				data: { id: VALID_TEST_ID, student_id: STUDENT_ID, status: "in_progress" },
			},
		},
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

	it("rejects an unauthenticated caller", async () => {
		mockUser.current = null;
		const out = await abandonPracticeTest({ testId: VALID_TEST_ID });
		expect(out).toEqual({ ok: false, message: expect.stringMatching(/signed in/i) });
	});

	it("rejects a test owned by another student (D9)", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				tests: {
					data: { id: VALID_TEST_ID, student_id: OTHER_STUDENT_ID, status: "in_progress" },
				},
			},
			rpcs: { practice_abandon_test: { data: null, error: null } },
		});
		const out = await abandonPracticeTest({ testId: VALID_TEST_ID });
		expect(out).toEqual({ ok: false, message: expect.stringMatching(/access/i) });
	});

	it("rejects a test that is no longer in_progress", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				tests: {
					data: { id: VALID_TEST_ID, student_id: STUDENT_ID, status: "graded" },
				},
			},
			rpcs: { practice_abandon_test: { data: null, error: null } },
		});
		const out = await abandonPracticeTest({ testId: VALID_TEST_ID });
		expect(out).toEqual({ ok: false, message: expect.stringMatching(/in progress/i) });
	});

	it("returns ok:false when the RPC errors", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				tests: {
					data: { id: VALID_TEST_ID, student_id: STUDENT_ID, status: "in_progress" },
				},
			},
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
