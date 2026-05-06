import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { subjects, topics } from "./academic";
import { profiles } from "./profiles";

/** Student "doubt chat" threads: one row per topic-scoped conversation. */
export const doubtConversations = pgTable(
	"doubt_conversations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		studentId: uuid("student_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		subjectId: uuid("subject_id")
			.notNull()
			.references(() => subjects.id, { onDelete: "restrict" }),
		topicId: uuid("topic_id")
			.notNull()
			.references(() => topics.id, { onDelete: "restrict" }),
		title: text("title"),
		model: varchar("model", { length: 120 }),
		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		index("idx_doubt_conversations_student_updated").on(t.studentId, t.updatedAt),
		index("idx_doubt_conversations_subject").on(t.subjectId),
	],
);

export const doubtMessages = pgTable(
	"doubt_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => doubtConversations.id, { onDelete: "cascade" }),
		role: varchar("role", { length: 20 }).notNull(),
		/** User messages: tutor mode when sent. Assistant rows leave null. */
		tutorMode: varchar("tutor_mode", { length: 20 }),
		content: text("content").notNull(),
		promptTokens: integer("prompt_tokens"),
		completionTokens: integer("completion_tokens"),
		model: varchar("model", { length: 120 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		index("idx_doubt_messages_conversation_created").on(t.conversationId, t.createdAt),
	],
);

/**
 * Worksheet photos / PDFs uploaded by students. Lifecycle:
 *   1. Composer client uploads to the `doubt-attachments` Storage bucket and
 *      inserts a row here with `messageId = null`.
 *   2. On send, the route handler binds the row(s) to the freshly-created
 *      user message by setting `messageId`.
 *   3. PDFs may have `ocrText` populated server-side on first use.
 */
export const doubtMessageAttachments = pgTable(
	"doubt_message_attachments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => doubtConversations.id, { onDelete: "cascade" }),
		messageId: uuid("message_id").references(() => doubtMessages.id, {
			onDelete: "cascade",
		}),
		kind: varchar("kind", { length: 10 }).notNull(),
		storagePath: text("storage_path").notNull(),
		mime: varchar("mime", { length: 80 }).notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		ocrText: text("ocr_text"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		index("idx_doubt_attachments_conversation").on(t.conversationId),
		index("idx_doubt_attachments_message").on(t.messageId),
		check("doubt_attachments_kind_check", sql`${t.kind} IN ('image','pdf')`),
		check("doubt_attachments_size_nonneg", sql`${t.sizeBytes} >= 0`),
	],
);
