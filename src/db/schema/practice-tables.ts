import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar, uniqueIndex } from "drizzle-orm/pg-core";

import { tests } from "./assessment";

export const practiceJobs = pgTable(
	"practice_jobs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		jobType: text("job_type").notNull(),
		testId: uuid("test_id")
			.references(() => tests.id, { onDelete: "cascade" }),
		studentId: uuid("student_id").notNull(),
		assignmentSubmissionId: uuid("assignment_submission_id"),
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
		index("idx_practice_jobs_assignment_submission").on(t.assignmentSubmissionId),
		uniqueIndex("practice_jobs_assignment_generate_active_uq")
			.on(t.assignmentSubmissionId)
			.where(sql`${t.jobType} = 'assign_generate_test' AND ${t.status} IN ('pending', 'running')`),
		check(
			"practice_jobs_required_ids_check",
			sql`(${t.jobType} = 'assign_generate_test' AND ${t.testId} IS NULL AND ${t.assignmentSubmissionId} IS NOT NULL)
				OR (${t.jobType} <> 'assign_generate_test' AND ${t.testId} IS NOT NULL AND ${t.assignmentSubmissionId} IS NULL)`,
		),
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

export const practiceGenerationRuns = pgTable(
	"practice_generation_runs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		correlationId: uuid("correlation_id").notNull(),
		studentId: uuid("student_id"),
		subjectId: uuid("subject_id"),
		testId: uuid("test_id")
			.references(() => tests.id, { onDelete: "set null" }),
		requestMode: text("request_mode").notNull(),
		configSnapshot: jsonb("config_snapshot").notNull().default({}),
		status: text("status").notNull().default("running"),
		failureCode: text("failure_code"),
		failureMessage: text("failure_message"),
		totalInputTokens: integer("total_input_tokens").notNull().default(0),
		totalOutputTokens: integer("total_output_tokens").notNull().default(0),
		totalAiCalls: integer("total_ai_calls").notNull().default(0),
		timingsMs: jsonb("timings_ms").notNull().default({}),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_practice_generation_runs_student_created").on(t.studentId, t.createdAt),
		index("idx_practice_generation_runs_test_created").on(t.testId, t.createdAt),
		index("idx_practice_generation_runs_subject_created").on(t.subjectId, t.createdAt),
		uniqueIndex("practice_generation_runs_correlation_id_uq").on(t.correlationId),
	],
);

export const practiceGenerationSteps = pgTable(
	"practice_generation_steps",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		runId: uuid("run_id")
			.notNull()
			.references(() => practiceGenerationRuns.id, { onDelete: "cascade" }),
		stepOrder: integer("step_order").notNull(),
		stepKey: varchar("step_key", { length: 64 }).notNull(),
		status: text("status").notNull(),
		model: varchar("model", { length: 64 }),
		feature: varchar("feature", { length: 64 }),
		latencyMs: integer("latency_ms"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		error: text("error"),
		metadata: jsonb("metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_practice_generation_steps_run_created").on(t.runId, t.createdAt),
		index("idx_practice_generation_steps_step_created").on(t.stepKey, t.createdAt),
		uniqueIndex("idx_practice_generation_steps_run_step_order").on(t.runId, t.stepOrder),
	],
);
