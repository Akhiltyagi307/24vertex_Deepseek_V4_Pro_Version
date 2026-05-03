import { bigint, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const serviceHealthPings = pgTable(
	"service_health_pings",
	{
		id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
		provider: varchar("provider", { length: 30 }).notNull(),
		status: varchar("status", { length: 10 }).notNull(),
		latencyMs: integer("latency_ms"),
		error: text("error"),
		checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_service_health_pings_provider_time").on(t.provider, t.checkedAt)],
);
