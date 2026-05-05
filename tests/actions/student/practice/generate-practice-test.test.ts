/**
 * Server-action tests for `generatePracticeTest`.
 *
 * What's covered:
 *   - Invalid input → validation_error
 *   - Preflight failure (rate limit / paywall / not enrolled) → result passthrough
 *   - Successful generation → result from `runPracticeGenerationAfterResolve`
 *
 * What's deliberately not covered:
 *   - The real OpenAI generation pipeline (own tests in src/lib/practice/__tests__/).
 *   - Rate-limit + billing decision logic (own factory tests).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const { mockSupabase, preflightMock, runMock } = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	preflightMock: { current: null as null | (() => Promise<unknown>) },
	runMock: { current: null as null | (() => Promise<unknown>) },
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/practice/practice-generation-pipeline", () => ({
	preflightPracticeGeneration: () => (preflightMock.current ?? (async () => ({ ok: false })))(),
	runPracticeGenerationAfterResolve: () => (runMock.current ?? (async () => ({ ok: false })))(),
}));

import { generatePracticeTest } from "@/app/student/practice/actions/generate-practice-test";

const SUBJECT_ID = "11111111-1111-1111-1111-111111111111";
const TRACKER_ID = "22222222-2222-2222-2222-222222222222";

const VALID_INPUT = {
	subjectId: SUBJECT_ID,
	trackerIds: [TRACKER_ID],
	difficulty: "medium" as const,
	durationSeconds: 3600 as const,
};

beforeEach(() => {
	mockSupabase.current = makeMockSupabase({});
	preflightMock.current = null;
	runMock.current = null;
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("generatePracticeTest", () => {
	it("returns validation_error on bad input", async () => {
		const out = await generatePracticeTest({ ...VALID_INPUT, trackerIds: [] });
		expect(out).toMatchObject({ ok: false, code: "validation_error" });
	});

	it("returns the preflight result when preflight fails (rate-limit)", async () => {
		preflightMock.current = async () => ({
			ok: false,
			result: { ok: false, code: "generation_failed", message: "Too many tests today." },
		});
		const out = await generatePracticeTest(VALID_INPUT);
		expect(out).toEqual({ ok: false, code: "generation_failed", message: "Too many tests today." });
	});

	it("returns the preflight result when paywalled", async () => {
		preflightMock.current = async () => ({
			ok: false,
			result: {
				ok: false,
				code: "trial_expired",
				message: "Your free trial has ended.",
				paywall: true,
			},
		});
		const out = await generatePracticeTest(VALID_INPUT);
		expect(out).toMatchObject({ ok: false, code: "trial_expired", paywall: true });
	});

	it("calls run pipeline with `useStreamObject: false` and forwards its result", async () => {
		preflightMock.current = async () => ({
			ok: true,
			resolved: {
				ok: true,
				studentGrade: 9,
				subjectName: "Mathematics",
				subjectGrade: 9,
				subjectGroup: null,
				canonicalTopics: [],
				recentErrors: [],
			},
		});
		runMock.current = async () => ({
			ok: true,
			testId: "test-1",
			subjectName: "Mathematics",
			questions: [],
			generation_metadata: { topicCoverage: {}, totalQuestions: 0 },
		});
		const out = await generatePracticeTest(VALID_INPUT);
		expect(out).toMatchObject({ ok: true, testId: "test-1" });
	});

	it("forwards a downstream generation_invalid failure", async () => {
		preflightMock.current = async () => ({
			ok: true,
			resolved: { ok: true, studentGrade: 9, subjectName: "Math", subjectGrade: 9, subjectGroup: null, canonicalTopics: [], recentErrors: [] },
		});
		runMock.current = async () => ({
			ok: false,
			code: "generation_invalid",
			message: "Model returned invalid JSON.",
		});
		const out = await generatePracticeTest(VALID_INPUT);
		expect(out).toEqual({ ok: false, code: "generation_invalid", message: "Model returned invalid JSON." });
	});
});
