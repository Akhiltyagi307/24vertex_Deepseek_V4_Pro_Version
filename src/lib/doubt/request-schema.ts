import { z } from "zod";

/**
 * Body schema for `POST /api/student/doubt-chat`.
 *
 * Lives in its own module (rather than inline in the route handler) so the
 * schema is testable without spinning up the route — the route requires
 * Supabase auth + rate-limit + billing-gate just to reach the validation
 * step, and we want regression coverage of validation alone.
 *
 * Why each field:
 *   - `messages` is `z.unknown()[]` rather than a typed UIMessage array
 *     because the @ai-sdk/react UIMessage type is intentionally loose
 *     (assistant tool blocks, files, parts) and we let the AI SDK
 *     normalize it via `convertToModelMessages` downstream. We only
 *     enforce that the array isn't empty.
 *   - `topicId` is optional / nullable so chapter-scoped conversations (DB
 *     `topic_id` null) can round-trip; the route validates against the stored row.
 *   - `tutorMode` defaults to "explain" so legacy clients without the
 *     field still work (the route launched before solve_with_me existed).
 */
export const doubtChatBodySchema = z.object({
	/** @ai-sdk/react chat id (optional) */
	id: z.string().optional(),
	messages: z.array(z.unknown()).min(1, "At least one message is required."),
	subjectId: z.string().uuid("Invalid subject."),
	/** Omit or null for chapter-scoped chats; must match the open conversation row. */
	topicId: z
		.union([z.string().uuid("Invalid topic."), z.null()])
		.optional()
		.transform((v) => (v === undefined ? null : v)),
	conversationId: z.string().uuid("Open or start a chat before sending a message."),
	tutorMode: z.enum(["explain", "solve_with_me"]).default("explain"),
	/**
	 * IDs from `doubt_message_attachments` already uploaded to Storage. The
	 * route validates ownership via the conversation join and then either
	 * sends image parts to the model or extracts PDF text inline.
	 */
	attachmentIds: z.array(z.string().uuid()).max(3).default([]),
});

export type DoubtChatBody = z.infer<typeof doubtChatBodySchema>;
