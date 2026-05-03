import { boolean, inet, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const adminSessions = pgTable(
	"admin_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		jwtId: varchar("jwt_id", { length: 100 }).notNull().unique(),
		ipAddress: inet("ip_address"),
		userAgent: text("user_agent"),
		totpUsed: boolean("totp_used").default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
);
