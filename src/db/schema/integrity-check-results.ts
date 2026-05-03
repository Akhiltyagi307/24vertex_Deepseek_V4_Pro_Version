import { bigint, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const integrityCheckResults = pgTable(
	"integrity_check_results",
	{
		id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
		checkName: varchar("check_name", { length: 100 }).notNull(),
		rowsFound: integer("rows_found").notNull(),
		details: jsonb("details"),
		ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_integrity_check_results_name_time").on(t.checkName, t.ranAt)],
);
