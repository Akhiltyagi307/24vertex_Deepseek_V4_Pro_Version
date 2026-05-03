import { bigint, boolean, index, inet, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const adminActionLog = pgTable(
	"admin_action_log",
	{
		id: bigint("id", { mode: "number" }).primaryKey(),
		action: varchar("action", { length: 100 }).notNull(),
		targetType: varchar("target_type", { length: 100 }),
		targetId: text("target_id"),
		payload: jsonb("payload"),
		ipAddress: inet("ip_address"),
		userAgent: text("user_agent"),
		totpUsed: boolean("totp_used").default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		index("idx_aal_created").on(t.createdAt),
		index("idx_aal_action").on(t.action),
		index("idx_aal_target").on(t.targetType, t.targetId),
	],
);
