/**
 * Route-handler tests for `POST /api/student/doubt-chat`.
 *
 * What's covered:
 *   - Bad JSON / schema validation
 *   - Auth missing
 *   - Rate-limit denial
 *   - Billing paywall
 *   - Scope validation (unauthorized vs other)
 *   - Empty / missing user message
 *   - Conversation not-found / wrong owner / scope drift
 *   - Successful turn (stream response 200)
 *
 * What's deliberately not covered:
 *   - The OpenAI provider's actual response shape — that's an integration
 *     concern. We mock `streamText` to return a real `Response`.
 *   - `recordAiCall`, `recordPracticeEvent`, `logSupabaseError` are
 *     fire-and-forget; we let them no-op naturally.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockAi, makeMockBilling, makeMockRateLimit, makeMockSupabase } from "../../factories";

// Hoisted shared state. Types are deliberately wide so a single test can flip
// the mock to a different verdict (e.g. paywall vs unauthorized) without
// fighting TypeScript narrowing on the initial value.
const { mockSupabase, mockServiceRoleSupabase, mockAi, mockRateLimit, mockBilling, resolveScopeMock, loadThreadMock } =
	vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	mockServiceRoleSupabase: { current: null as unknown },
	mockAi: { current: null as unknown },
	mockRateLimit: { current: null as unknown },
	mockBilling: { current: null as unknown },
	resolveScopeMock: { current: null as null | (() => Promise<unknown>) },
	loadThreadMock: { current: null as null | (() => Promise<unknown[]>) },
	}));

type RateLimitBindings = ReturnType<typeof makeMockRateLimit>;
type BillingBindings = ReturnType<typeof makeMockBilling>;
type AiBindings = ReturnType<typeof makeMockAi>;

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => mockServiceRoleSupabase.current,
}));
vi.mock("@/lib/practice/practice-rate-limit", () => ({
	consumeDoubtChatRateLimit: () => (mockRateLimit.current as RateLimitBindings).consumeDoubtChatRateLimit(),
	consumeGenerationRateLimit: () => (mockRateLimit.current as RateLimitBindings).consumeGenerationRateLimit(),
	consumePracticeRateLimit: () => (mockRateLimit.current as RateLimitBindings).consumePracticeRateLimit(),
	consumeStudyTipsRateLimit: () => (mockRateLimit.current as RateLimitBindings).consumeStudyTipsRateLimit(),
	consumeAdaptiveFollowupsRateLimit: () =>
		(mockRateLimit.current as RateLimitBindings).consumeAdaptiveFollowupsRateLimit(),
}));
vi.mock("@/lib/billing/entitlements", () => ({
	canStartDoubtChat: () => (mockBilling.current as BillingBindings).canStartDoubtChat(),
	preflightPracticeTestQuota: () => (mockBilling.current as BillingBindings).preflightPracticeTestQuota(),
	consumeTokens: async () => undefined,
}));
vi.mock("ai", () => ({
	streamText: (...args: unknown[]) => (mockAi.current as AiBindings).streamText(...args),
	convertToModelMessages: (m: unknown) => (mockAi.current as AiBindings).convertToModelMessages(m),
}));
vi.mock("@/lib/ai/openai-provider", () => ({
	getOpenAIProvider: () => ({ chat: () => ({ id: "gpt-test" }) }),
}));
vi.mock("@/lib/ai/record-ai-call", () => ({
	recordAiCall: async () => undefined,
}));
vi.mock("@/lib/ai/prompt-store", () => ({
	getActiveAiPrompt: async () => null,
}));
vi.mock("@/lib/practice/analytics", () => ({
	recordPracticeEvent: async () => undefined,
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	logServerError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));
vi.mock("@/lib/env", () => ({
	getOpenAIDoubtChatModel: () => "gpt-test",
	getSupabaseUrl: () => "http://localhost:54321",
	getSupabasePublishableKey: () => "test",
	getComplianceExportsBucket: () => "compliance-exports",
	isProductionDeployment: () => false,
}));
const DEFAULT_SCOPE_OK = {
	ok: true as const,
	kind: "topic" as const,
	userId: "00000000-0000-0000-0000-000000000099",
	studentGrade: 9,
	subjectId: "11111111-1111-1111-1111-111111111111",
	subjectName: "Mathematics",
	topic: {
		id: "22222222-2222-2222-2222-222222222222",
		unitName: "Algebra Foundations",
		unitNumber: 1,
		chapterName: "Linear Equations",
		chapterNumber: 1,
		topicName: "Solving Linear Equations",
		topicNumber: 1,
		description: "Linear equations in one variable.",
		learningObjectives: ["Solve linear equations.", "Verify solutions."],
	},
};

const CHAPTER_SCOPE_OK = {
	ok: true as const,
	kind: "chapter" as const,
	userId: "00000000-0000-0000-0000-000000000099",
	studentGrade: 9,
	subjectId: "11111111-1111-1111-1111-111111111111",
	subjectName: "Mathematics",
	chapter: {
		unitName: "Algebra Foundations",
		unitNumber: 1,
		chapterName: "Linear Equations",
		chapterNumber: 1,
		topicIds: ["22222222-2222-2222-2222-222222222222"],
		topicNamesBlock: "- Solving Linear Equations",
		topicDescription: "Chapter aggregate description.",
		learningObjectivesBlock: "- Solve linear equations.",
	},
};

vi.mock("@/lib/doubt/validate-doubt-scope", () => ({
	resolveDoubtScopeForConversation: () =>
		resolveScopeMock.current ? resolveScopeMock.current() : Promise.resolve(DEFAULT_SCOPE_OK),
}));
vi.mock("@/lib/doubt/loaders", () => ({
	loadDoubtMessagesForConversationWithClient: () =>
		loadThreadMock.current
			? loadThreadMock.current()
			: Promise.resolve([{ id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] }]),
}));

import { POST } from "@/app/api/student/doubt-chat/route";

const VALID_BODY = {
	messages: [{ role: "user", parts: [{ type: "text", text: "explain photosynthesis" }] }],
	subjectId: "11111111-1111-1111-1111-111111111111",
	topicId: "22222222-2222-2222-2222-222222222222",
	conversationId: "33333333-3333-3333-3333-333333333333",
	tutorMode: "explain" as const,
};

const VALID_USER = { id: "00000000-0000-0000-0000-000000000099" };
const MATCHING_CONVO = {
	data: {
		id: VALID_BODY.conversationId,
		student_id: VALID_USER.id,
		subject_id: VALID_BODY.subjectId,
		topic_id: VALID_BODY.topicId,
		metadata: {},
	},
	error: null,
};

const MATCHING_CHAPTER_CONVO = {
	data: {
		id: VALID_BODY.conversationId,
		student_id: VALID_USER.id,
		subject_id: VALID_BODY.subjectId,
		topic_id: null,
		metadata: {
			doubt_scope: "chapter",
			chapter: {
				unit_number: 1,
				chapter_number: 1,
				chapter_name: "Linear Equations",
				unit_name: "Algebra Foundations",
			},
		},
	},
	error: null,
};

const VALID_BODY_CHAPTER = {
	...VALID_BODY,
	topicId: null,
};

function makeRequest(body: unknown): Request {
	return new Request("http://localhost/api/student/doubt-chat", {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

describe("POST /api/student/doubt-chat", () => {
	beforeEach(() => {
		mockSupabase.current = makeMockSupabase({
			user: VALID_USER,
			tables: {
				doubt_conversations: () => MATCHING_CONVO,
				// Route now does `.insert(...).select("id").maybeSingle()` to capture
				// the freshly-inserted message id (used to bind attachments). The
				// mock must return a row.
				doubt_messages: {
					data: { id: "44444444-4444-4444-4444-444444444444" },
					error: null,
				},
				doubt_message_attachments: { data: [], error: null },
			},
		});
		mockServiceRoleSupabase.current = makeMockSupabase({
			tables: {
				topic_context_chunks: {
					data: [
						{
							topic_id: "22222222-2222-2222-2222-222222222222",
							content: "Linear equations can be solved by balancing both sides.",
							chunk_type: "context",
							source_ref: "NCERT Ch 1",
							created_at: "2026-01-01T00:00:00.000Z",
						},
					],
					error: null,
				},
			},
		});
		mockAi.current = makeMockAi({ streamText: { text: "ok" } });
		mockRateLimit.current = makeMockRateLimit({ doubtChat: { ok: true } });
		mockBilling.current = makeMockBilling({ canStartDoubtChat: { ok: true } });
		resolveScopeMock.current = null;
		loadThreadMock.current = async () => [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
		];
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns 400 on bad JSON body", async () => {
		const res = await POST(makeRequest("{not json"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid request");
	});

	it("returns 400 with details on schema validation failure", async () => {
		const res = await POST(makeRequest({ ...VALID_BODY, subjectId: "not-a-uuid" }));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid request");
		expect(body.details).toBeDefined();
	});

	it("returns 401 when no user is authenticated", async () => {
		mockSupabase.current = makeMockSupabase({ user: null });
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("returns 429 when the rate limiter denies", async () => {
		(mockRateLimit.current as RateLimitBindings).__set({ doubtChat: { ok: false, message: "Slow down." } });
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(429);
		const body = await res.json();
		expect(body.error).toBe("Slow down.");
	});

	it("returns 402 with paywall: true when billing denies", async () => {
		(mockBilling.current as BillingBindings).__set({
			canStartDoubtChat: { ok: false, code: "trial_expired", message: "Your trial ended." },
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(402);
		const body = await res.json();
		expect(body.paywall).toBe(true);
		expect(body.code).toBe("trial_expired");
		expect(body.error).toBe("Your trial ended.");
	});

	it("returns 401 when scope validation reports unauthorized", async () => {
		resolveScopeMock.current = async () => ({
			ok: false,
			code: "unauthorized",
			message: "Not your subject.",
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.code).toBe("unauthorized");
	});

	it("returns 400 when scope validation reports a non-unauthorized failure", async () => {
		resolveScopeMock.current = async () => ({
			ok: false,
			code: "subject_inactive",
			message: "Subject is no longer active.",
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.code).toBe("subject_inactive");
	});

	it("returns 400 when the last user message text is empty", async () => {
		const res = await POST(
			makeRequest({
				...VALID_BODY,
				messages: [{ role: "user", parts: [{ type: "text", text: "" }] }],
			}),
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Message text is empty.");
	});

	it("returns 404 when the conversation is not found or owned by another user", async () => {
		mockSupabase.current = makeMockSupabase({
			user: VALID_USER,
			tables: {
				doubt_conversations: () => ({
					data: { ...MATCHING_CONVO.data, student_id: "another-user" },
					error: null,
				}),
			},
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("Conversation not found.");
	});

	it("returns 400 when the conversation's subject differs from the request", async () => {
		mockSupabase.current = makeMockSupabase({
			user: VALID_USER,
			tables: {
				doubt_conversations: () => ({
					data: {
						...MATCHING_CONVO.data,
						subject_id: "99999999-9999-9999-9999-999999999999",
					},
					error: null,
				}),
			},
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Subject no longer matches this chat.");
	});

	it("returns 400 when the request topicId does not match the conversation", async () => {
		mockSupabase.current = makeMockSupabase({
			user: VALID_USER,
			tables: {
				doubt_conversations: () => ({
					data: {
						...MATCHING_CONVO.data,
						topic_id: "99999999-9999-9999-9999-999999999999",
					},
					error: null,
				}),
			},
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Topic scope no longer matches this chat.");
	});

	it("returns the streamed Response on the success path", async () => {
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(200);
	});

	it("returns 400 when topic_context_chunks are missing for the resolved scope", async () => {
		mockServiceRoleSupabase.current = makeMockSupabase({
			tables: {
				topic_context_chunks: { data: [], error: null },
			},
		});
		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.code).toBe("context_chunks_missing");
	});

	it("returns the streamed Response for chapter-scoped conversation with null topicId", async () => {
		mockSupabase.current = makeMockSupabase({
			user: VALID_USER,
			tables: {
				doubt_conversations: () => MATCHING_CHAPTER_CONVO,
				doubt_messages: {
					data: { id: "44444444-4444-4444-4444-444444444444" },
					error: null,
				},
				doubt_message_attachments: { data: [], error: null },
			},
		});
		resolveScopeMock.current = async () => CHAPTER_SCOPE_OK;
		const res = await POST(makeRequest(VALID_BODY_CHAPTER));
		expect(res.status).toBe(200);
	});

	it("keeps prior PDF transcript in model context for follow-up turns", async () => {
		loadThreadMock.current = async () => [
			{
				id: "prior-user-msg",
				role: "user",
				parts: [{ type: "text", text: "Please summarize this PDF first." }],
			},
			{
				id: "prior-assistant-msg",
				role: "assistant",
				parts: [{ type: "text", text: "I can help. Ask your follow-up." }],
			},
			{
				id: "latest-user-msg",
				role: "user",
				parts: [{ type: "text", text: "Now explain it in simple terms." }],
			},
		];
		mockSupabase.current = makeMockSupabase({
			user: VALID_USER,
			tables: {
				doubt_conversations: () => MATCHING_CONVO,
				doubt_messages: {
					data: { id: "44444444-4444-4444-4444-444444444444" },
					error: null,
				},
				doubt_message_attachments: {
					data: [
						{
							id: "55555555-5555-5555-5555-555555555555",
							conversation_id: VALID_BODY.conversationId,
							message_id: "prior-user-msg",
							kind: "pdf",
							storage_path: `${VALID_USER.id}/${VALID_BODY.conversationId}/worksheet.pdf`,
							mime: "application/pdf",
							size_bytes: 1024,
							ocr_text: "The Himalayas extend west to east and include Himadri, Himachal, and Shiwalik.",
							created_at: "2026-01-01T00:00:00.000Z",
						},
					],
					error: null,
				},
			},
		});

		const convertSpy = vi.fn(async (messages: unknown) => messages);
		(mockAi.current as AiBindings).convertToModelMessages = convertSpy;

		const res = await POST(makeRequest({ ...VALID_BODY, attachmentIds: [] }));
		expect(res.status).toBe(200);

		expect(convertSpy).toHaveBeenCalledTimes(1);
		const modelInput = convertSpy.mock.calls[0]?.[0] as Array<{
			id?: string;
			role?: string;
			parts?: Array<{ type?: string; text?: string }>;
		}>;
		const priorUser = modelInput.find((m) => m.id === "prior-user-msg");
		const latestUser = modelInput.find((m) => m.id === "latest-user-msg");
		const priorText = (priorUser?.parts ?? [])
			.filter((p) => p.type === "text")
			.map((p) => p.text ?? "")
			.join("\n");
		const latestText = (latestUser?.parts ?? [])
			.filter((p) => p.type === "text")
			.map((p) => p.text ?? "")
			.join("\n");

		expect(priorText).toContain("[Attached PDF 1: worksheet.pdf]");
		expect(priorText).toContain("The Himalayas extend west to east");
		expect(latestText).not.toContain("[Attached PDF 1:");
	});

	it("adds an explicit attached-pdf marker even when extraction text is empty", async () => {
		loadThreadMock.current = async () => [
			{
				id: "prior-user-msg",
				role: "user",
				parts: [{ type: "text", text: "Can you read this attachment?" }],
			},
			{
				id: "latest-user-msg",
				role: "user",
				parts: [{ type: "text", text: "What does this pdf contain?" }],
			},
		];
		mockSupabase.current = makeMockSupabase({
			user: VALID_USER,
			tables: {
				doubt_conversations: () => MATCHING_CONVO,
				doubt_messages: {
					data: { id: "44444444-4444-4444-4444-444444444444" },
					error: null,
				},
				doubt_message_attachments: {
					data: [
						{
							id: "77777777-7777-7777-7777-777777777777",
							conversation_id: VALID_BODY.conversationId,
							message_id: "prior-user-msg",
							kind: "pdf",
							storage_path: `${VALID_USER.id}/${VALID_BODY.conversationId}/scan.pdf`,
							mime: "application/pdf",
							size_bytes: 4096,
							ocr_text: " ",
							created_at: "2026-01-01T00:00:00.000Z",
						},
					],
					error: null,
				},
			},
		});

		const convertSpy = vi.fn(async (messages: unknown) => messages);
		(mockAi.current as AiBindings).convertToModelMessages = convertSpy;

		const res = await POST(makeRequest({ ...VALID_BODY, attachmentIds: [] }));
		expect(res.status).toBe(200);

		const modelInput = convertSpy.mock.calls[0]?.[0] as Array<{
			id?: string;
			parts?: Array<{ type?: string; text?: string }>;
		}>;
		const priorUser = modelInput.find((m) => m.id === "prior-user-msg");
		const priorText = (priorUser?.parts ?? [])
			.filter((p) => p.type === "text")
			.map((p) => p.text ?? "")
			.join("\n");
		expect(priorText).toContain("[Attached PDF 1: scan.pdf]");
		expect(priorText).toContain("Text extraction returned empty content");
	});
});
