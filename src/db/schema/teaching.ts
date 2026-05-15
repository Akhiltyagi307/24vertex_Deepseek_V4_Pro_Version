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

import { subjects } from "./academic";
import { tests } from "./assessment";
import { organizations } from "./organizations";

export const teacherAssignments = pgTable(
	"teacher_assignments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: uuid("teacher_id").notNull(),
		grade: integer("grade").notNull(),
		section: varchar("section", { length: 5 }).notNull(),
		subjectId: uuid("subject_id")
			.notNull()
			.references(() => subjects.id),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [
		unique().on(t.teacherId, t.grade, t.section, t.subjectId),
		index("idx_teacher_assign_teacher").on(t.teacherId),
		index("idx_teacher_assign_grade_section").on(t.grade, t.section),
	],
);

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
