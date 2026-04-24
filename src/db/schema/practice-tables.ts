import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tests } from "./assessment";

export const practiceRateLimits = pgTable(
	"practice_rate_limits",
	{
		studentId: uuid("student_id").notNull(),
		bucket: text("bucket").notNull(),
		windowStart: timestamp("window_start").notNull(),
		count: integer("count").notNull().default(0),
	},
	(t) => [
		index("idx_practice_rate_limits_student_bucket").on(t.studentId, t.bucket, t.windowStart),
	],
);

export const practiceJobs = pgTable(
	"practice_jobs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		jobType: text("job_type").notNull(),
		testId: uuid("test_id")
			.notNull()
			.references(() => tests.id, { onDelete: "cascade" }),
		studentId: uuid("student_id").notNull(),
		status: text("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(3),
		payload: jsonb("payload").notNull().default({}),
		error: text("error"),
		runAfter: timestamp("run_after").notNull().defaultNow(),
		claimedAt: timestamp("claimed_at"),
		claimedBy: text("claimed_by"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(t) => [
		index("idx_practice_jobs_status_run_after").on(t.status, t.runAfter),
		index("idx_practice_jobs_test").on(t.testId),
		index("idx_practice_jobs_student").on(t.studentId, t.createdAt),
	],
);

export const practiceAnalyticsEvents = pgTable(
	"practice_analytics_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		studentId: uuid("student_id"),
		eventName: text("event_name").notNull(),
		props: jsonb("props").notNull().default({}),
		occurredAt: timestamp("occurred_at").notNull().defaultNow(),
	},
	(t) => [
		index("idx_practice_analytics_event_time").on(t.eventName, t.occurredAt),
		index("idx_practice_analytics_student_time").on(t.studentId, t.occurredAt),
	],
);
