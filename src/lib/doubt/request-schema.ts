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
/**
 * Note: this schema deliberately does NOT use `.strict()` because the @ai-sdk
 * /react `useChat` transport may attach internal fields (e.g. `trigger`,
 * `messageId`) that we want to tolerate. The explicit fields we DO use are
 * pinned to UUIDs / enums so an attacker can't widen the schema by smuggling
 * a forged value.
 */
export const doubtChatBodySchema = z.object({
	/** @ai-sdk/react chat id (optional) */
	id: z.string().optional(),
	messages: z
		.array(z.unknown())
		.min(1, "At least one message is required.")
		// Bound the array so a malicious client can't POST an unbounded list.
		// The transport sends the full visible thread, so this cap is generous —
		// the route reloads history from the DB and only reads the last message.
		.max(1000, "Conversation too long."),
	subjectId: z.string().uuid("Invalid subject."),
	/** Omit or null for chapter-scoped chats; must match the open conversation row. */
	topicId: z
		.union([z.string().uuid("Invalid topic."), z.null()])
		.optional()
		.transform((v) => (v === undefined ? null : v)),
	conversationId: z.string().uuid("Open or start a chat before sending a message."),
	tutorMode: z.enum(["explain", "solve_with_me", "quiz_me"]).default("explain"),
	/**
	 * The mode the *previous* turn was sent under. When this differs from
	 * `tutorMode` we know the student just toggled modes in the composer and
	 * we append a one-line ephemeral note to the system prompt for this turn
	 * so the model treats earlier turns as historical context under the old
	 * contract. Optional — legacy clients without it just don't get the note.
	 */
	previousTutorMode: z.enum(["explain", "solve_with_me", "quiz_me"]).optional(),
	/**
	 * IDs from `doubt_message_attachments` already uploaded to Storage. The
	 * route validates ownership via the conversation join and then either
	 * sends image parts to the model or extracts PDF text inline.
	 */
	attachmentIds: z.array(z.string().uuid()).max(3).default([]),
});

export type DoubtChatBody = z.infer<typeof doubtChatBodySchema>;
