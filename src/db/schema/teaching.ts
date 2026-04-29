import {
	boolean,
	decimal,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { subjects } from "./academic";
import { tests } from "./assessment";

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
		title: varchar("title", { length: 300 }).notNull(),
		description: text("description"),
		assignmentType: varchar("assignment_type", { length: 20 }).default("test"),
		subjectId: uuid("subject_id")
			.notNull()
			.references(() => subjects.id),
		unitName: varchar("unit_name", { length: 250 }),
		topicIds: uuid("topic_ids").array(),
		difficulty: varchar("difficulty", { length: 10 }),
		questionCount: integer("question_count").default(20),
		timeLimitSeconds: integer("time_limit_seconds").default(3600),
		targetGrades: integer("target_grades").array().notNull(),
		targetSections: varchar("target_sections", { length: 5 }).array().notNull(),
		targetStudentIds: uuid("target_student_ids").array(),
		dueDate: timestamp("due_date").notNull(),
		lateSubmissionPolicy: varchar("late_submission_policy", { length: 20 }).default("allow"),
		latePenaltyPercent: integer("late_penalty_percent").default(0),
		instructions: text("instructions"),
		status: varchar("status", { length: 20 }).default("active"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		index("idx_assignments_teacher").on(t.teacherId),
		index("idx_assignments_status").on(t.status),
		index("idx_assignments_due").on(t.dueDate),
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
		testId: uuid("test_id").references(() => tests.id),
		status: varchar("status", { length: 20 }).default("pending"),
		score: decimal("score", { precision: 5, scale: 2 }),
		submittedAt: timestamp("submitted_at"),
		isLate: boolean("is_late").default(false),
		penaltyApplied: decimal("penalty_applied", { precision: 5, scale: 2 }).default("0"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		unique().on(t.assignmentId, t.studentId),
		index("idx_submissions_assignment").on(t.assignmentId),
		index("idx_submissions_student").on(t.studentId),
		index("idx_submissions_status").on(t.status),
	],
);
