import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

export const userFeedbackReports = pgTable(
	"user_feedback_reports",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		portal: varchar("portal", { length: 20 }).notNull(),
		category: varchar("category", { length: 30 }).notNull(),
		impact: varchar("impact", { length: 20 }),
		title: varchar("title", { length: 200 }),
		description: text("description").notNull(),
		pagePath: text("page_path").notNull(),
		sentryEventId: varchar("sentry_event_id", { length: 64 }),
		errorDigest: varchar("error_digest", { length: 64 }),
		context: jsonb("context").notNull().default({}),
		status: varchar("status", { length: 20 }).notNull().default("open"),
		adminNotes: text("admin_notes"),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_user_feedback_reports_status_created").on(t.status, t.createdAt),
		index("idx_user_feedback_reports_user_created").on(t.userId, t.createdAt),
	],
);
