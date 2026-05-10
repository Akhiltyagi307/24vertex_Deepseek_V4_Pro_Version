/**
 * Validation tests for the doubt-chat body schema.
 *
 * These don't exercise the route handler (which needs Supabase auth, rate
 * limit, billing gate, and OpenAI). They lock down the input contract that
 * the schema enforces — i.e. the boundary every request crosses before any
 * of those downstream gates run.
 */
import { describe, expect, it } from "vitest";

import { doubtChatBodySchema } from "@/lib/doubt/request-schema";

const validUuid = (n: number) => `${"0".repeat(7)}${n}-0000-0000-0000-000000000000`.slice(-36);

const validBody = {
	messages: [{ role: "user", content: "what is 2+2" }],
	subjectId: validUuid(1),
	topicId: validUuid(2),
	conversationId: validUuid(3),
	tutorMode: "explain" as const,
};

describe("doubtChatBodySchema", () => {
	it("accepts a minimal valid request", () => {
		const r = doubtChatBodySchema.safeParse(validBody);
		expect(r.success, JSON.stringify(r.success ? "" : r.error.flatten())).toBe(true);
	});

	it("defaults tutorMode to 'explain' when omitted", () => {
		const omitTutorMode = (b: typeof validBody) => {
			const copy: Record<string, unknown> = { ...b };
			delete copy.tutorMode;
			return copy;
		};
		const r = doubtChatBodySchema.safeParse(omitTutorMode(validBody));
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.tutorMode).toBe("explain");
	});

	it("rejects empty messages array (must have at least one)", () => {
		const r = doubtChatBodySchema.safeParse({ ...validBody, messages: [] });
		expect(r.success).toBe(false);
	});

	it("rejects non-UUID subjectId", () => {
		const r = doubtChatBodySchema.safeParse({ ...validBody, subjectId: "not-a-uuid" });
		expect(r.success).toBe(false);
	});

	it("accepts null topicId for chapter-scoped chats", () => {
		const r = doubtChatBodySchema.safeParse({ ...validBody, topicId: null });
		expect(r.success, JSON.stringify(r.success ? "" : r.error.flatten())).toBe(true);
		if (r.success) expect(r.data.topicId).toBeNull();
	});

	it("defaults omitted topicId to null", () => {
		const omitTopic = (b: typeof validBody) => {
			const copy: Record<string, unknown> = { ...b };
			delete copy.topicId;
			return copy;
		};
		const r = doubtChatBodySchema.safeParse(omitTopic(validBody));
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.topicId).toBeNull();
	});

	it("rejects invalid topicId string", () => {
		const r = doubtChatBodySchema.safeParse({ ...validBody, topicId: "still-not-a-uuid" });
		expect(r.success).toBe(false);
	});

	it("rejects non-UUID conversationId — required so a missing chat doesn't silently start a new one", () => {
		const r = doubtChatBodySchema.safeParse({ ...validBody, conversationId: "" });
		expect(r.success).toBe(false);
	});

	it("rejects unknown tutorMode (gates the prompt-template selection)", () => {
		const r = doubtChatBodySchema.safeParse({ ...validBody, tutorMode: "rogue_mode" });
		expect(r.success).toBe(false);
	});

	it("accepts both supported tutor modes", () => {
		expect(doubtChatBodySchema.safeParse({ ...validBody, tutorMode: "explain" }).success).toBe(true);
		expect(doubtChatBodySchema.safeParse({ ...validBody, tutorMode: "solve_with_me" }).success).toBe(true);
	});

	it("returns flattenable field errors so the route can pass them to the client", () => {
		const r = doubtChatBodySchema.safeParse({
			messages: [],
			subjectId: "x",
			topicId: "x",
			conversationId: "x",
		});
		expect(r.success).toBe(false);
		if (!r.success) {
			const flat = r.error.flatten();
			expect(flat.fieldErrors.messages?.length ?? 0).toBeGreaterThan(0);
			expect(flat.fieldErrors.subjectId?.length ?? 0).toBeGreaterThan(0);
			expect(flat.fieldErrors.topicId?.length ?? 0).toBeGreaterThan(0);
			expect(flat.fieldErrors.conversationId?.length ?? 0).toBeGreaterThan(0);
		}
	});
});
