import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

export const moderationFlags = pgTable(
	"moderation_flags",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		entityType: varchar("entity_type", { length: 30 }).notNull(),
		entityId: uuid("entity_id").notNull(),
		reportedBy: uuid("reported_by").references(() => profiles.id, { onDelete: "set null" }),
		source: varchar("source", { length: 30 }).notNull(),
		reason: text("reason"),
		severity: varchar("severity", { length: 20 }).notNull().default("medium"),
		status: varchar("status", { length: 20 }).notNull().default("open"),
		resolution: varchar("resolution", { length: 30 }),
		resolutionNotes: text("resolution_notes"),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_moderation_flags_status").on(t.status),
		index("idx_moderation_flags_entity").on(t.entityType, t.entityId),
		index("idx_moderation_flags_created").on(t.createdAt),
	],
);
