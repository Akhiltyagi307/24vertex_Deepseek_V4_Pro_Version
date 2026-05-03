import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const broadcasts = pgTable(
	"broadcasts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		subject: varchar("subject", { length: 500 }).notNull(),
		bodyMd: text("body_md").notNull(),
		audienceJson: jsonb("audience_json").notNull().default({}),
		channelsJson: jsonb("channels_json").notNull().default({ in_app: true, email: false, priority_urgent: false }),
		status: varchar("status", { length: 30 }).notNull().default("draft"),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		recipientCount: integer("recipient_count"),
		error: text("error"),
		statsJson: jsonb("stats_json"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_broadcasts_created").on(t.createdAt),
		index("idx_broadcasts_status").on(t.status),
	],
);
