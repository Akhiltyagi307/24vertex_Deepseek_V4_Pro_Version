/**
 * Server-action tests for `finalizePracticeConfig`.
 *
 * What's covered:
 *   - Invalid input (missing fields, duplicate trackers) → validation_error
 *   - Resolve helper failure → mapped failure
 *   - Preview disabled (default) → ok:true, code:"success", no payload
 *   - Preview enabled → ok:true with userMessageJson + systemPrompt + topics
 *
 * What's deliberately not covered:
 *   - The actual resolve / prompt-building helpers (their own tests live in
 *     src/lib/practice/__tests__/). Here we mock them and verify the action's
 *     branching only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const {
	mockSupabase,
	mockAdmin,
	resolveMock,
	buildUserMock,
	buildSystemMock,
	stringifyMock,
	fetchChunksMock,
} = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	mockAdmin: { current: null as unknown },
	resolveMock: { current: null as null | (() => Promise<unknown>) },
	buildUserMock: { current: vi.fn(() => ({ schema_version: "1", intent: "x", test_parameters: {}, constraints: {} })) },
	buildSystemMock: { current: vi.fn(() => "SYSTEM_PROMPT") },
	stringifyMock: { current: vi.fn(() => "USER_MESSAGE_JSON") },
	fetchChunksMock: { current: vi.fn(async () => []) },
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => mockAdmin.current,
}));
vi.mock("@/lib/practice", async (orig) => {
	const actual = (await orig()) as Record<string, unknown>;
	return {
		...actual,
		resolvePracticeConfigForStudent: () => (resolveMock.current ?? (async () => ({ ok: false })))(),
		buildPracticeUserMessage: (...args: unknown[]) =>
			(buildUserMock.current as (...a: unknown[]) => unknown)(...args),
		buildPracticeSystemPrompt: (...args: unknown[]) =>
			(buildSystemMock.current as (...a: unknown[]) => unknown)(...args),
		stringifyPracticeUserMessageForModel: (...args: unknown[]) =>
			(stringifyMock.current as (...a: unknown[]) => unknown)(...args),
		fetchTopicContextChunksByTopicIds: (...args: unknown[]) =>
			(fetchChunksMock.current as (...a: unknown[]) => unknown)(...args),
	};
});

import { finalizePracticeConfig } from "@/app/student/practice/actions/finalize-practice-config";

const SUBJECT_ID = "11111111-1111-1111-1111-111111111111";
const TRACKER_ID = "22222222-2222-2222-2222-222222222222";
const TOPIC_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = {
	subjectId: SUBJECT_ID,
	trackerIds: [TRACKER_ID],
	difficulty: "medium" as const,
	durationSeconds: 3600 as const,
};

beforeEach(() => {
	mockSupabase.current = makeMockSupabase({});
	mockAdmin.current = makeMockSupabase({});
	resolveMock.current = null;
	buildUserMock.current = vi.fn(() => ({
		schema_version: "1",
		intent: "x",
		test_parameters: {},
		constraints: {},
	}));
	buildSystemMock.current = vi.fn(() => "SYSTEM_PROMPT");
	stringifyMock.current = vi.fn(() => "USER_MESSAGE_JSON");
	fetchChunksMock.current = vi.fn(async () => []);
	vi.stubEnv("PRACTICE_PROMPT_PREVIEW", "");
	vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

describe("finalizePracticeConfig — input validation", () => {
	it("returns validation_error when trackerIds is empty", async () => {
		const out = await finalizePracticeConfig({
			...VALID_INPUT,
			trackerIds: [],
		});
		expect(out).toMatchObject({ ok: false, code: "validation_error" });
	});

	it("returns validation_error when subjectId is not a UUID", async () => {
		const out = await finalizePracticeConfig({
			...VALID_INPUT,
			subjectId: "nope",
		});
		expect(out).toMatchObject({ ok: false, code: "validation_error" });
	});

	it("returns validation_error when durationSeconds is not 3600 or 10800", async () => {
		const out = await finalizePracticeConfig({
			...VALID_INPUT,
			durationSeconds: 7200,
		});
		expect(out).toMatchObject({ ok: false, code: "validation_error" });
	});

	it("returns validation_error when trackerIds has duplicates", async () => {
		const out = await finalizePracticeConfig({
			...VALID_INPUT,
			trackerIds: [TRACKER_ID, TRACKER_ID],
		});
		expect(out).toMatchObject({ ok: false, code: "validation_error" });
	});
});

describe("finalizePracticeConfig — resolve failure passthrough", () => {
	it("maps a resolve failure to a finalize failure", async () => {
		resolveMock.current = async () => ({
			ok: false,
			code: "subject_not_enrolled",
			message: "You aren't enrolled in this subject.",
		});
		const out = await finalizePracticeConfig(VALID_INPUT);
		expect(out).toEqual({
			ok: false,
			code: "subject_not_enrolled",
			message: "You aren't enrolled in this subject.",
		});
	});
});

describe("finalizePracticeConfig — happy path", () => {
	beforeEach(() => {
		resolveMock.current = async () => ({
			ok: true,
			studentGrade: 9,
			subjectName: "Mathematics",
			subjectGrade: 9,
			subjectGroup: "STEM",
			canonicalTopics: [
				{
					topicId: TOPIC_ID,
					topicName: "Algebra",
					unitName: "Numbers",
					unitNumber: 1,
					chapterName: "Linear",
					chapterNumber: 1,
					topicNumber: 1,
				},
			],
			recentErrors: [],
		});
	});

	it("returns ok with no payload when preview is disabled", async () => {
		const out = await finalizePracticeConfig(VALID_INPUT);
		expect(out).toEqual({ ok: true, code: "success" });
		expect(buildUserMock.current).not.toHaveBeenCalled();
	});

	it("returns ok with payload when PRACTICE_PROMPT_PREVIEW=true and not production", async () => {
		vi.stubEnv("PRACTICE_PROMPT_PREVIEW", "true");
		vi.stubEnv("NODE_ENV", "development");
		const out = await finalizePracticeConfig(VALID_INPUT);
		expect(out.ok).toBe(true);
		if (out.ok) {
			expect(out.code).toBe("success");
			expect(out.userMessageJson).toBe("USER_MESSAGE_JSON");
			expect(out.systemPrompt).toBe("SYSTEM_PROMPT");
			expect(out.canonicalTopics).toHaveLength(1);
		}
		expect(buildUserMock.current).toHaveBeenCalledTimes(1);
		expect(buildSystemMock.current).toHaveBeenCalledTimes(1);
	});

	it("does not surface payload when NODE_ENV=production even if the env flag is set", async () => {
		vi.stubEnv("PRACTICE_PROMPT_PREVIEW", "true");
		vi.stubEnv("NODE_ENV", "production");
		const out = await finalizePracticeConfig(VALID_INPUT);
		expect(out).toEqual({ ok: true, code: "success" });
	});
});
