import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
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
		content: text("content").notNull(),
		promptTokens: integer("prompt_tokens"),
		completionTokens: integer("completion_tokens"),
		model: varchar("model", { length: 120 }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("idx_doubt_messages_conversation_created").on(t.conversationId, t.createdAt),
	],
);
