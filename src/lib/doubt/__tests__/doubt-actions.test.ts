/**
 * Server-action rate-limit coverage. Both `createDoubtConversation` and
 * `getDoubtTopicsForSubjectAction` now call `consumeDoubtChatRateLimit` and
 * return `{ ok: false, code: "rate_limited" }` on denial. Without this, those
 * actions could be flooded outside the 40/hr route bucket.
 */
import { describe, expect, it, vi } from "vitest";

const { rateLimitMock } = vi.hoisted(() => ({
	rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/practice/practice-rate-limit", () => ({
	consumeDoubtChatRateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));

vi.mock("@/lib/env", () => ({
	getOpenAIChatModel: () => "gpt-test",
}));

vi.mock("@/lib/doubt/validate-doubt-scope", () => ({
	validateDoubtScope: vi.fn(),
}));

vi.mock("@/lib/doubt/loaders", () => ({
	loadDoubtTopicRows: vi.fn(async () => []),
}));

vi.mock("@/lib/student/get-student-subjects-rpc", () => ({
	getStudentSubjectsRpc: vi.fn(async () => ({ data: [], error: null })),
}));

const { supabaseMock } = vi.hoisted(() => ({
	supabaseMock: {
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: { id: "00000000-0000-0000-0000-000000000099" } },
				error: null,
			})),
		},
		from: vi.fn(() => ({
			select: () => ({
				eq: () => ({
					maybeSingle: vi.fn(async () => ({
						data: {
							grade: 9,
							stream: null,
							elective_subject_id: null,
							role: "student",
						},
						error: null,
					})),
				}),
			}),
		})),
	},
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => supabaseMock,
}));

import { createDoubtConversation, getDoubtTopicsForSubjectAction } from "@/lib/doubt/doubt-actions";

const VALID_INPUT = {
	subjectId: "11111111-1111-1111-1111-111111111111",
	topicId: "22222222-2222-2222-2222-222222222222",
};

describe("doubt server actions — rate limit", () => {
	it("createDoubtConversation returns rate_limited when the bucket is full", async () => {
		rateLimitMock.mockResolvedValueOnce({
			ok: false,
			message: "Slow down — try again at 13:45.",
			resetAt: new Date().toISOString(),
		});

		const res = await createDoubtConversation(VALID_INPUT);
		expect(res).toEqual({
			ok: false,
			code: "rate_limited",
			message: "Slow down — try again at 13:45.",
		});
	});

	it("getDoubtTopicsForSubjectAction returns rate_limited when the bucket is full", async () => {
		rateLimitMock.mockResolvedValueOnce({
			ok: false,
			message: "Slow down — try again at 14:00.",
			resetAt: new Date().toISOString(),
		});

		const res = await getDoubtTopicsForSubjectAction({ subjectId: VALID_INPUT.subjectId });
		expect(res).toEqual({
			ok: false,
			code: "rate_limited",
			message: "Slow down — try again at 14:00.",
		});
	});
});
