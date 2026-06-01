import {
	bigint,
	boolean,
	decimal,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar,
	vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { subjects, topics } from "./academic";

export const performanceTracker = pgTable(
	"performance_tracker",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		studentId: uuid("student_id").notNull(),
		topicId: uuid("topic_id")
			.notNull()
			.references(() => topics.id, { onDelete: "cascade" }),
		subjectId: uuid("subject_id")
			.notNull()
			.references(() => subjects.id),
		status: varchar("status", { length: 20 }).default("not_tested"),
		lastTestId: uuid("last_test_id"),
		lastTestDate: timestamp("last_test_date"),
		averageScore: decimal("average_score", { precision: 5, scale: 2 }),
		testsTaken: integer("tests_taken").default(0),
		confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).default("0"),
		trend: varchar("trend", { length: 20 }).default("stable"),
		nextReviewAt: timestamp("next_review_at"),
		reviewIntervalDays: integer("review_interval_days"),
		reviewEase: decimal("review_ease", { precision: 3, scale: 2 }),
		consecutiveGood: integer("consecutive_good").notNull().default(0),
		updatedAt: timestamp("updated_at").defaultNow(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [
		unique().on(t.studentId, t.topicId),
		index("idx_perf_student_subject").on(t.studentId, t.subjectId),
		index("idx_perf_status").on(t.status),
		index("idx_perf_student").on(t.studentId),
		index("idx_perf_next_review").on(t.nextReviewAt).where(sql`${t.nextReviewAt} is not null`),
	],
);

export const tests = pgTable(
	"tests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		studentId: uuid("student_id").notNull(),
		subjectId: uuid("subject_id")
			.notNull()
			.references(() => subjects.id),
		unitName: varchar("unit_name", { length: 250 }),
		testType: varchar("test_type", { length: 20 }).default("self"),
		testDate: timestamp("test_date", { withTimezone: true }).defaultNow(),
		durationSeconds: integer("duration_seconds"),
		timeLimitSeconds: integer("time_limit_seconds").default(3600),
		status: varchar("status", { length: 20 }).default("in_progress"),
		totalScore: decimal("total_score", { precision: 5, scale: 2 }),
		totalQuestions: integer("total_questions").default(20),
		correctAnswers: integer("correct_answers").default(0),
		isDraft: boolean("is_draft").default(false),
		difficulty: varchar("difficulty", { length: 10 }),
		startedAt: timestamp("started_at", { withTimezone: true }),
		autoSubmitted: boolean("auto_submitted").default(false),
		abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
		questionCount: integer("question_count"),
		questionMix: jsonb("question_mix"),
		/** Operator pause — student UI freezes timer while true (PDR §4.28). */
		isPaused: boolean("is_paused").notNull().default(false),
		/** Count of admin timer extensions (audit). */
		adminExtensions: integer("admin_extensions").notNull().default(0),
		assignmentSubmissionId: uuid("assignment_submission_id"),
		deviceFingerprint: varchar("device_fingerprint", { length: 64 }),
		lastIp: varchar("last_ip", { length: 45 }),
		tabBlurCount: integer("tab_blur_count").notNull().default(0),
		pausedAt: timestamp("paused_at", { withTimezone: true }),
		accumulatedPauseSeconds: integer("accumulated_pause_seconds").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		index("idx_tests_student").on(t.studentId),
		index("idx_tests_status").on(t.status),
		index("idx_tests_type").on(t.testType),
		uniqueIndex("idx_tests_assignment_submission_uq")
			.on(t.assignmentSubmissionId)
			.where(sql`${t.assignmentSubmissionId} IS NOT NULL`),
		index("idx_tests_status_updated").on(t.status, t.updatedAt),
	],
);

export const adminTestMessages = pgTable(
	"admin_test_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		testId: uuid("test_id")
			.notNull()
			.references(() => tests.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_admin_test_messages_test_created").on(t.testId, t.createdAt)],
);

export const questions = pgTable(
	"questions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		testId: uuid("test_id")
			.notNull()
			.references(() => tests.id, { onDelete: "cascade" }),
		topicId: uuid("topic_id")
			.notNull()
			.references(() => topics.id),
		questionText: text("question_text").notNull(),
		questionType: varchar("question_type", { length: 20 }).notNull(),
		difficultyLevel: varchar("difficulty_level", { length: 10 }),
		answerKey: jsonb("answer_key").notNull(),
		options: jsonb("options"),
		questionNumber: integer("question_number").notNull(),
		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at").defaultNow(),
		embedding: vector("embedding", { dimensions: 1536 }),
	},
	(t) => [
		index("idx_questions_test").on(t.testId),
		index("idx_questions_topic").on(t.topicId),
		unique("questions_test_question_number_uidx").on(t.testId, t.questionNumber),
	],
);

export const studentAnswers = pgTable(
	"student_answers",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		testId: uuid("test_id")
			.notNull()
			.references(() => tests.id, { onDelete: "cascade" }),
		questionId: uuid("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		studentAnswer: jsonb("student_answer").notNull(),
		isCorrect: boolean("is_correct"),
		scoreEarned: decimal("score_earned", { precision: 5, scale: 2 }),
		aiFeedback: text("ai_feedback"),
		aiUserAnswerSummary: text("ai_user_answer_summary"),
		aiReferenceAnswerSummary: text("ai_reference_answer_summary"),
		timeSpentSeconds: integer("time_spent_seconds"),
		timeSpentMs: bigint("time_spent_ms", { mode: "number" }).default(0),
		visits: integer("visits").default(0),
		flaggedForReview: boolean("flagged_for_review").default(false),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		index("idx_answers_test").on(t.testId),
		unique("student_answers_test_question_uidx").on(t.testId, t.questionId),
	],
);

export const testReports = pgTable("test_reports", {
	id: uuid("id").defaultRandom().primaryKey(),
	testId: uuid("test_id")
		.notNull()
		.references(() => tests.id, { onDelete: "cascade" })
		.unique(),
	studentId: uuid("student_id").notNull(),
	summaryReport: jsonb("summary_report").notNull(),
	strengths: text("strengths").array(),
	improvementAreas: text("improvement_areas").array(),
	aiInsights: text("ai_insights"),
	topicPerformance: jsonb("topic_performance"),
	recommendations: text("recommendations").array(),
	pdfStoragePath: text("pdf_storage_path"),
	gradingFailedAt: timestamp("grading_failed_at", { withTimezone: true }),
	gradingError: text("grading_error"),
	createdAt: timestamp("created_at").defaultNow(),
});

export const questionFlags = pgTable(
	"question_flags",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		questionId: uuid("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		studentId: uuid("student_id").notNull(),
		reason: text("reason").notNull(),
		notes: text("notes"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("idx_question_flags_question").on(t.questionId),
		index("idx_question_flags_student").on(t.studentId, t.createdAt),
	],
);
