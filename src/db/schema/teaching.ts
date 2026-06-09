import {
	boolean,
	decimal,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { topics } from "./academic";
import { tests } from "./assessment";
import { organizations } from "./organizations";

// NOTE: the legacy `teacher_assignments` table + its Drizzle def were removed
// (L-4). The live DB table was dropped by 20260428203000 / 20260520130000 and
// never recreated (the 20260618130000 hardening only recreated `assignments`
// and `assignment_submissions`). No code queried the Drizzle symbol.

export const assignments = pgTable(
	"assignments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: uuid("teacher_id").notNull(),
		organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
		assignmentKind: text("assignment_kind").notNull().default("practice_test"),
		title: varchar("title", { length: 300 }).notNull(),
		instructions: text("instructions"),
		config: jsonb("config").notNull().default({}),
		dueAt: timestamp("due_at", { withTimezone: true }),
		status: varchar("status", { length: 20 }).notNull().default("draft"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_assignments_teacher_created").on(t.teacherId, t.createdAt),
		index("idx_assignments_status_due").on(t.status, t.dueAt),
		index("idx_assignments_org_created").on(t.organizationId, t.createdAt),
	],
);

export const assignmentSubmissions = pgTable(
	"assignment_submissions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		assignmentId: uuid("assignment_id")
			.notNull()
			.references(() => assignments.id, { onDelete: "cascade" }),
		studentId: uuid("student_id").notNull(),
		testId: uuid("test_id").references(() => tests.id, { onDelete: "set null" }),
		lifecycleStatus: varchar("lifecycle_status", { length: 32 }).notNull().default("pending_materialize"),
		score: decimal("score", { precision: 5, scale: 2 }),
		submittedAt: timestamp("submitted_at", { withTimezone: true }),
		gradedAt: timestamp("graded_at", { withTimezone: true }),
		isLate: boolean("is_late").notNull().default(false),
		penaltyApplied: decimal("penalty_applied", { precision: 5, scale: 2 }).notNull().default("0"),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique().on(t.assignmentId, t.studentId),
		index("idx_assignment_submissions_assignment_status").on(t.assignmentId, t.lifecycleStatus),
		index("idx_assignment_submissions_student_status").on(t.studentId, t.lifecycleStatus),
		index("idx_assignment_submissions_test").on(t.testId),
	],
);

export const assignmentQuestions = pgTable(
	"assignment_questions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		assignmentId: uuid("assignment_id")
			.notNull()
			.references(() => assignments.id, { onDelete: "cascade" }),
		questionNumber: integer("question_number").notNull(),
		topicId: uuid("topic_id")
			.notNull()
			.references(() => topics.id),
		questionType: varchar("question_type", { length: 20 }).notNull(),
		questionText: text("question_text").notNull(),
		options: jsonb("options"),
		answerKey: jsonb("answer_key").notNull(),
		difficultyLevel: varchar("difficulty_level", { length: 10 }).notNull().default("medium"),
		metadata: jsonb("metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("assignment_questions_number_uq").on(t.assignmentId, t.questionNumber),
		index("idx_assignment_questions_assignment").on(t.assignmentId, t.questionNumber),
	],
);
