import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Operator job mirror (`public.jobs`). Processed by `/api/internal/admin/process-operator-jobs`. Not `practice_jobs`. */
export const operatorJobs = pgTable(
	"jobs",
	{
		id: varchar("id", { length: 100 }).primaryKey(),
		queue: varchar("queue", { length: 100 }).notNull(),
		name: varchar("name", { length: 200 }).notNull(),
		payload: jsonb("payload"),
		status: varchar("status", { length: 20 }).notNull(),
		progress: integer("progress").notNull().default(0),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(3),
		error: text("error"),
		result: jsonb("result"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		startedAt: timestamp("started_at", { withTimezone: true }),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		triggeredBy: varchar("triggered_by", { length: 100 }),
	},
	(t) => [
		index("idx_jobs_status_created").on(t.status, t.createdAt),
		index("idx_jobs_queue_status").on(t.queue, t.status),
	],
);
