/**
 * Server-action tests for `app/student/practice/session-actions.ts`.
 *
 * Covers `upsertPracticeAnswer`, `submitPracticeTest`, `retryPracticeGrading`.
 * `appendAdaptiveFollowups` is gated by `PRACTICE_ADAPTIVE=true` and exercises
 * the AI generation pipeline; deferred to its own integration test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const {
	mockSupabase,
	mockAdmin,
	assertTestMock,
	writeRowMock,
	executeSubmitMock,
	redirectPathMock,
	fetchMock,
} = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	mockAdmin: { current: null as unknown },
	assertTestMock: { current: null as null | (() => Promise<unknown>) },
	writeRowMock: { current: null as null | (() => Promise<unknown>) },
	executeSubmitMock: { current: null as null | (() => Promise<unknown>) },
	redirectPathMock: {
		current: vi.fn((id: string, _sub?: string, _status?: string) => `/student/practice/${id}/results`),
	},
	fetchMock: { current: vi.fn(async () => ({ ok: true, status: 200 })) },
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => mockAdmin.current,
}));
vi.mock("@/lib/practice/submit-practice-shared", () => ({
	assertTestOwnedByStudent: () => (assertTestMock.current ?? (async () => ({ ok: true })))(),
	assertTestOwnedInProgress: () => (assertTestMock.current ?? (async () => ({ ok: false })))(),
	writeStudentAnswerRow: () => (writeRowMock.current ?? (async () => ({ error: null })))(),
	executePracticeTestSubmit: () => (executeSubmitMock.current ?? (async () => ({ ok: false })))(),
	redirectPathForExistingTestSubmission: (id: string, sub?: string, status?: string) =>
		redirectPathMock.current(id, sub, status),
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	logServerError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));
vi.mock("@/lib/env", () => ({
	getAppUrl: () => "https://test.example.com",
	getOpenAIChatModel: () => "gpt-test",
	getSupabaseUrl: () => "http://localhost:54321",
	getSupabasePublishableKey: () => "test",
	isProductionDeployment: () => false,
}));

// Avoid actually firing the worker; vitest's global fetch is replaced.
const originalFetch = globalThis.fetch;
beforeEach(() => {
	mockSupabase.current = makeMockSupabase({ user: { id: STUDENT_ID } });
	mockAdmin.current = makeMockSupabase({ user: { id: STUDENT_ID } });
	assertTestMock.current = async () => ({ ok: true });
	writeRowMock.current = async () => ({ error: null });
	executeSubmitMock.current = null;
	redirectPathMock.current = vi.fn(
		(id: string, _sub?: string, _status?: string) => `/student/practice/${id}/results`,
	);
	fetchMock.current = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
	globalThis.fetch = ((...args: Parameters<typeof globalThis.fetch>) =>
		(fetchMock.current as unknown as (...a: unknown[]) => Promise<Response>)(
			...args,
		)) as typeof globalThis.fetch;
	vi.stubEnv("PRACTICE_SYNC_GRADING", "");
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

import {
	retryPracticeGrading,
	submitPracticeTest,
	upsertPracticeAnswer,
} from "@/app/student/practice/session-actions";

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const TEST_ID = "22222222-2222-2222-2222-222222222222";
const QUESTION_ID = "33333333-3333-3333-3333-333333333333";

/* -------------------------------------------------------------------------- */
/*                            upsertPracticeAnswer                             */
/* -------------------------------------------------------------------------- */

describe("upsertPracticeAnswer", () => {
	it("rejects an invalid payload (missing testId)", async () => {
		const out = await upsertPracticeAnswer({});
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/invalid/i) });
	});

	it("returns ok:false when not authenticated", async () => {
		mockSupabase.current = makeMockSupabase({ user: null });
		const out = await upsertPracticeAnswer({
			testId: TEST_ID,
			questionId: QUESTION_ID,
			studentAnswer: { kind: "text", value: "answer" },
		});
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/sign in/i) });
	});

	it("returns the gate failure when the test is not owned / not in_progress", async () => {
		assertTestMock.current = async () => ({ ok: false, message: "This test is no longer in progress." });
		const out = await upsertPracticeAnswer({
			testId: TEST_ID,
			questionId: QUESTION_ID,
			studentAnswer: { kind: "text", value: "answer" },
		});
		expect(out).toEqual({ ok: false, message: "This test is no longer in progress." });
	});

	it("rejects when the question is not found", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: { questions: { data: null } },
		});
		const out = await upsertPracticeAnswer({
			testId: TEST_ID,
			questionId: QUESTION_ID,
			studentAnswer: { kind: "text", value: "answer" },
		});
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/not found/i) });
	});

	it("rejects when the answer kind doesn't match the question type", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				questions: { data: { id: QUESTION_ID, test_id: TEST_ID, question_type: "multiple_choice" } },
			},
		});
		const out = await upsertPracticeAnswer({
			testId: TEST_ID,
			questionId: QUESTION_ID,
			// MCQ question but text answer.
			studentAnswer: { kind: "text", value: "answer" },
		});
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/answer type/i) });
	});

	it("returns ok on the happy path (text question)", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				questions: { data: { id: QUESTION_ID, test_id: TEST_ID, question_type: "short_answer" } },
			},
		});
		const out = await upsertPracticeAnswer({
			testId: TEST_ID,
			questionId: QUESTION_ID,
			studentAnswer: { kind: "text", value: "answer" },
		});
		expect(out).toEqual({ ok: true });
	});

	it("returns ok on the happy path (mcq question)", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				questions: { data: { id: QUESTION_ID, test_id: TEST_ID, question_type: "multiple_choice" } },
			},
		});
		const out = await upsertPracticeAnswer({
			testId: TEST_ID,
			questionId: QUESTION_ID,
			studentAnswer: { kind: "mcq", value: "A" },
		});
		expect(out).toEqual({ ok: true });
	});

	it("returns a friendly DB error when the upsert fails", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				questions: { data: { id: QUESTION_ID, test_id: TEST_ID, question_type: "short_answer" } },
			},
		});
		writeRowMock.current = async () => ({ error: { message: "constraint violation" } });
		const out = await upsertPracticeAnswer({
			testId: TEST_ID,
			questionId: QUESTION_ID,
			studentAnswer: { kind: "text", value: "x" },
		});
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/save/i) });
	});
});

/* -------------------------------------------------------------------------- */
/*                              submitPracticeTest                             */
/* -------------------------------------------------------------------------- */

describe("submitPracticeTest", () => {
	it("rejects an invalid payload (missing elapsedSeconds)", async () => {
		const out = await submitPracticeTest({ testId: TEST_ID });
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/invalid/i) });
	});

	it("returns ok:false when not authenticated", async () => {
		mockSupabase.current = makeMockSupabase({ user: null });
		const out = await submitPracticeTest({ testId: TEST_ID, elapsedSeconds: 60 });
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/sign in/i) });
	});

	it("delegates to executePracticeTestSubmit when PRACTICE_SYNC_GRADING=true", async () => {
		vi.stubEnv("PRACTICE_SYNC_GRADING", "true");
		executeSubmitMock.current = async () => ({
			ok: true,
			redirectTo: "/student/practice/sync-result",
		});
		const out = await submitPracticeTest({ testId: TEST_ID, elapsedSeconds: 600 });
		expect(out).toEqual({ ok: true, redirectTo: "/student/practice/sync-result" });
	});

	it("returns a friendly DB error when practice_start_grading errors", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			rpcs: {
				practice_start_grading: { error: { message: "boom" } },
			},
		});
		const out = await submitPracticeTest({ testId: TEST_ID, elapsedSeconds: 600 });
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/submit/i) });
	});

	it("redirects to existing test when start_grading returns an empty rowset", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			rpcs: {
				practice_start_grading: { data: [] },
			},
			tables: {
				tests: { data: { subject_id: "subj-1", status: "submitted" } },
			},
		});
		const out = await submitPracticeTest({ testId: TEST_ID, elapsedSeconds: 600 });
		expect(out.ok).toBe(true);
		expect(redirectPathMock.current).toHaveBeenCalledWith(TEST_ID, "subj-1", "submitted");
	});

	it("returns ok with the grading redirect on the happy path", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			rpcs: {
				practice_start_grading: { data: [{ test_id: TEST_ID, subject_id: "subj-1" }] },
				practice_enqueue_job: { data: null, error: null },
			},
		});
		const out = await submitPracticeTest({ testId: TEST_ID, elapsedSeconds: 600 });
		expect(out).toEqual({ ok: true, redirectTo: `/student/practice/${TEST_ID}/grading` });
	});
});

/* -------------------------------------------------------------------------- */
/*                            retryPracticeGrading                             */
/* -------------------------------------------------------------------------- */

describe("retryPracticeGrading", () => {
	it("rejects an invalid payload", async () => {
		const out = await retryPracticeGrading({});
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/invalid/i) });
	});

	it("requires authentication", async () => {
		mockSupabase.current = makeMockSupabase({ user: null });
		const out = await retryPracticeGrading({ testId: TEST_ID });
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/sign in/i) });
	});

	it("rejects when the test is not found or owned by another student", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: { tests: { data: null } },
		});
		const out = await retryPracticeGrading({ testId: TEST_ID });
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/not found/i) });
	});

	it("rejects when the test is not in a failed grading state", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				tests: { data: { id: TEST_ID, student_id: STUDENT_ID, status: "in_progress" } },
			},
		});
		const out = await retryPracticeGrading({ testId: TEST_ID });
		expect(out).toMatchObject({ ok: false, message: expect.stringMatching(/grading state/i) });
	});

	it("returns ok and re-enqueues on the happy path", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				tests: { data: { id: TEST_ID, student_id: STUDENT_ID, status: "grading_failed" } },
			},
			rpcs: {
				practice_enqueue_job: { data: null, error: null },
			},
		});
		const out = await retryPracticeGrading({ testId: TEST_ID });
		expect(out).toEqual({ ok: true });
	});
});
