import {
	bigint,
	boolean,
	decimal,
	index,
	inet,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { topics } from "./academic";
import { broadcasts } from "./broadcasts";

export const notifications = pgTable(
	"notifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		recipientId: uuid("recipient_id").notNull(),
		senderId: uuid("sender_id"),
		title: varchar("title", { length: 300 }).notNull(),
		body: text("body").notNull(),
		type: varchar("type", { length: 30 }).notNull(),
		priority: varchar("priority", { length: 10 }).default("normal"),
		category: varchar("category", { length: 30 }),
		referenceType: varchar("reference_type", { length: 30 }),
		referenceId: uuid("reference_id"),
		/** Student profile this row is about (parent portal and multi-child context). */
		contextStudentId: uuid("context_student_id"),
		isRead: boolean("is_read").default(false),
		readAt: timestamp("read_at"),
		emailSent: boolean("email_sent").default(false),
		emailSentAt: timestamp("email_sent_at"),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [
		index("idx_notif_recipient").on(t.recipientId, t.isRead),
		index("idx_notif_created").on(t.createdAt),
	],
);

export const emailLog = pgTable(
	"email_log",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
		recipientId: uuid("recipient_id"),
		subject: varchar("subject", { length: 500 }).notNull(),
		template: varchar("template", { length: 100 }),
		status: varchar("status", { length: 20 }).default("queued"),
		providerMessageId: varchar("provider_message_id", { length: 200 }),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at").defaultNow(),
		sentAt: timestamp("sent_at"),
		providerPayload: jsonb("provider_payload"),
		openedAt: timestamp("opened_at"),
		clickedAt: timestamp("clicked_at"),
		broadcastId: uuid("broadcast_id").references(() => broadcasts.id, { onDelete: "set null" }),
	},
	(t) => [index("idx_email_log_created").on(t.createdAt), index("idx_email_log_broadcast").on(t.broadcastId)],
);

export const resources = pgTable("resources", {
	id: uuid("id").defaultRandom().primaryKey(),
	topicId: uuid("topic_id")
		.notNull()
		.references(() => topics.id, { onDelete: "cascade" }),
	resourceType: varchar("resource_type", { length: 20 }),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	url: varchar("url", { length: 1000 }).notNull(),
	difficultyLevel: varchar("difficulty_level", { length: 20 }),
	durationMinutes: integer("duration_minutes"),
	source: varchar("source", { length: 100 }),
	rating: decimal("rating", { precision: 3, scale: 2 }),
	createdAt: timestamp("created_at").defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull().unique(),
	preferredDifficulty: varchar("preferred_difficulty", { length: 10 }).default("medium"),
	testDurationPreference: integer("test_duration_preference").default(3600),
	enableEmailNotifications: boolean("enable_email_notifications").default(true),
	enableInappNotifications: boolean("enable_inapp_notifications").default(true),
	notificationTypes: jsonb("notification_types").default({
		test_result: true,
		announcement: true,
		reminder: true,
		usage_alert: true,
	}),
	preferredLanguage: varchar("preferred_language", { length: 5 }).default("en"),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
	id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
	userId: uuid("user_id"),
	action: varchar("action", { length: 100 }).notNull(),
	entityType: varchar("entity_type", { length: 100 }),
	entityId: uuid("entity_id"),
	changes: jsonb("changes"),
	ipAddress: inet("ip_address"),
	createdAt: timestamp("created_at").defaultNow(),
});
