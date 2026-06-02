/**
 * Server-action tests for `appendAdaptiveFollowups` (Phase-3 adaptive
 * follow-up question generation, gated by `PRACTICE_ADAPTIVE=true`).
 *
 * What's covered:
 *   - Feature-flag gate
 *   - Bad payload
 *   - Auth missing
 *   - Rate-limit denial
 *   - Test not in_progress (status mismatch)
 *   - All test topics soft-deleted between test creation and follow-up
 *     request (the Sprint 4 fix that ensured admin-soft-deleted topics
 *     don't silently re-appear via adaptive followups)
 *   - generateObject throws
 *   - RPC append failure
 *   - Successful append
 *
 * Mocks `validateAndStripGeneration` and `practiceGenerationOutputSchema`
 * via the `@/lib/practice` barrel so the test doesn't need to construct a
 * fully schema-valid generation. The schema-validation logic itself has
 * dedicated unit tests in `src/lib/practice/__tests__/`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { makeMockSupabase } from "../../factories";

const { mocks } = vi.hoisted(() => ({
	mocks: {
		supabase: null as ReturnType<typeof makeMockSupabase> | null,
		admin: null as ReturnType<typeof makeMockSupabase> | null,
		rateLimitVerdict: { ok: true } as { ok: true } | { ok: false; message: string },
		entitlementGate: { ok: true } as { ok: true } | { ok: false; code: string; message: string },
		generateObjectImpl: async () => ({
			object: { questions: [] as unknown[] },
			usage: { inputTokens: 10, outputTokens: 20 },
		}) as { object: { questions: unknown[] }; usage: { inputTokens: number; outputTokens: number } } | unknown,
		validateImpl: ((...args: unknown[]) => {
			void args;
			return { ok: true as const, questions: [], generation_metadata: {} };
		}) as (...args: unknown[]) => unknown,
	},
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mocks.supabase,
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => mocks.admin,
}));
vi.mock("@/lib/practice/practice-rate-limit", () => ({
	consumeAdaptiveFollowupsRateLimit: async () => mocks.rateLimitVerdict,
	consumePracticeRateLimit: async () => ({ ok: true }),
	consumeGenerationRateLimit: async () => ({ ok: true }),
	consumeStudyTipsRateLimit: async () => ({ ok: true }),
	consumeDoubtChatRateLimit: async () => ({ ok: true }),
}));
vi.mock("@/lib/ai/openai-provider", () => ({
	getOpenAIProvider: () => () => ({ id: "gpt-test" }),
}));
vi.mock("@/lib/ai/record-ai-call", () => ({
	recordAiCall: async () => undefined,
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	logServerError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));
vi.mock("@/lib/env", () => ({
	getOpenAIChatModel: () => "gpt-test",
	getAppUrl: () => "http://localhost:3000",
	getSupabaseUrl: () => "http://localhost:54321",
	getSupabasePublishableKey: () => "test",
	getComplianceExportsBucket: () => "compliance-exports",
	isProductionDeployment: () => false,
}));
vi.mock("ai", () => ({
	generateObject: () => mocks.generateObjectImpl(),
}));
vi.mock("@/lib/practice", () => ({
	practiceGenerationOutputSchema: { parse: (x: unknown) => x },
	validateAndStripGeneration: (...args: unknown[]) => mocks.validateImpl(...args),
	practiceDifficultySchema: z.enum(["easy", "medium", "hard"]),
}));
// appendAdaptiveFollowups now gates on the AI-token entitlement and debits
// tokens after generation. Preserve the real module and override just those two.
vi.mock("@/lib/billing/entitlements", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/billing/entitlements")>();
	return {
		...actual,
		canStartDoubtChat: async () => mocks.entitlementGate,
		consumeTokens: async () => undefined,
	};
});

import { appendAdaptiveFollowups } from "@/app/student/practice/session-actions";

const TEST_ID = "00000000-0000-0000-0000-000000000099";
const VALID_USER = { id: "00000000-0000-0000-0000-0000000000aa" };
const VALID_INPUT = { testId: TEST_ID, runningScore: 75, count: 3 };

const ACTIVE_TEST_ROW = {
	id: TEST_ID,
	student_id: VALID_USER.id,
	subject_id: "00000000-0000-0000-0000-0000000000bb",
	difficulty: "medium",
	status: "in_progress",
	question_count: 5,
};

function userSupabase(testRow: unknown) {
	return makeMockSupabase({
		user: VALID_USER,
		tables: {
			tests: { data: testRow, error: null },
		},
		rpcs: {
			practice_append_questions: { data: 3, error: null },
		},
	});
}

function adminWithTopics(activeIds: string[], allIds = activeIds) {
	return makeMockSupabase({
		tables: {
			questions: { data: allIds.map((id) => ({ topic_id: id })), error: null },
			topics: {
				data: activeIds.map((id) => ({ id, topic_name: `Topic ${id}` })),
				error: null,
			},
		},
	});
}

const TOPIC_A = "00000000-0000-0000-0000-0000000000cc";

describe("appendAdaptiveFollowups", () => {
	beforeEach(() => {
		vi.stubEnv("PRACTICE_ADAPTIVE", "true");
		mocks.supabase = userSupabase(ACTIVE_TEST_ROW);
		mocks.admin = adminWithTopics([TOPIC_A]);
		mocks.rateLimitVerdict = { ok: true };
		mocks.entitlementGate = { ok: true };
		mocks.generateObjectImpl = async () => ({
			object: {
				questions: [
					{
						topic_id: TOPIC_A,
						question_text: "Q?",
						question_type: "short_answer",
						difficulty_level: "medium",
						answer_key: { correct_answer: "A" },
						options: null,
					},
				],
			},
			usage: { inputTokens: 10, outputTokens: 20 },
		});
		mocks.validateImpl = () => ({
			ok: true,
			questions: [
				{
					topic_id: TOPIC_A,
					question_text: "Q?",
					question_type: "short_answer",
					difficulty_level: "medium",
					answer_key: { correct_answer: "A" },
					options: null,
				},
			],
			generation_metadata: {},
		});
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

	it("rejects when PRACTICE_ADAPTIVE is not 'true'", async () => {
		vi.stubEnv("PRACTICE_ADAPTIVE", "");
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r).toEqual({ ok: false, message: "Adaptive follow-ups are disabled." });
	});

	it("rejects bad payloads", async () => {
		const r = await appendAdaptiveFollowups({ testId: "not-a-uuid" });
		expect(r).toEqual({ ok: false, message: "Invalid payload." });
	});

	it("rejects when there is no authenticated user", async () => {
		mocks.supabase = makeMockSupabase({ user: null });
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r).toEqual({ ok: false, message: "Sign in to continue." });
	});

	it("returns the rate-limit message when the gate denies", async () => {
		mocks.rateLimitVerdict = { ok: false, message: "Slow down." };
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r).toEqual({ ok: false, message: "Slow down." });
	});

	it("rejects when the AI-token entitlement gate denies (lapsed / out of tokens)", async () => {
		mocks.entitlementGate = { ok: false, code: "quota_tokens", message: "You've used your token allowance." };
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r).toEqual({ ok: false, message: "You've used your token allowance." });
	});

	it("rejects when the test is not in_progress", async () => {
		mocks.supabase = userSupabase({ ...ACTIVE_TEST_ROW, status: "completed" });
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r).toEqual({ ok: false, message: "Test is not in progress." });
	});

	it("rejects when none of the test's topics are still active (Sprint 4 fix)", async () => {
		// allIds has one topic, but activeIds is empty — admin soft-deleted it.
		mocks.admin = adminWithTopics([], [TOPIC_A]);
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.message).toMatch(/None of this test's topics/);
	});

	it("returns a generation failure when generateObject throws", async () => {
		mocks.generateObjectImpl = async () => {
			throw new Error("provider down");
		};
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r).toEqual({ ok: false, message: "Follow-up generation failed." });
	});

	it("returns a 'could not append' error when the practice_append_questions RPC fails", async () => {
		mocks.supabase = makeMockSupabase({
			user: VALID_USER,
			tables: { tests: { data: ACTIVE_TEST_ROW, error: null } },
			rpcs: { practice_append_questions: { data: null, error: { message: "boom" } } },
		});
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r).toEqual({ ok: false, message: "Could not append questions." });
	});

	it("returns ok: true with the added count on the success path", async () => {
		const r = await appendAdaptiveFollowups(VALID_INPUT);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.added).toBeGreaterThan(0);
	});
});
