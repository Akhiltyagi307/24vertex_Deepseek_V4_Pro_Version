import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const subjects = pgTable(
	"subjects",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: varchar("name", { length: 250 }).notNull(),
		grade: integer("grade").notNull(),
		subjectGroup: varchar("subject_group", { length: 200 }),
		stream: varchar("stream", { length: 50 }),
		isElective: boolean("is_elective").default(false),
		sortOrder: integer("sort_order").default(0).notNull(),
		isActive: boolean("is_active").default(true),
		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		index("idx_subjects_grade").on(t.grade),
		index("idx_subjects_stream").on(t.stream),
		index("idx_subjects_elective").on(t.isElective),
		index("idx_subjects_group").on(t.subjectGroup),
		index("idx_subjects_grade_stream").on(t.grade, t.stream),
	],
);

export const topics = pgTable(
	"topics",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		subjectId: uuid("subject_id")
			.notNull()
			.references(() => subjects.id, { onDelete: "cascade" }),
		grade: integer("grade").notNull(),
		unitName: varchar("unit_name", { length: 250 }).notNull(),
		unitNumber: integer("unit_number").notNull(),
		chapterName: varchar("chapter_name", { length: 250 }).notNull(),
		chapterNumber: integer("chapter_number").notNull(),
		topicName: varchar("topic_name", { length: 250 }).notNull(),
		topicNumber: integer("topic_number").notNull(),
		description: text("description"),
		learningObjectives: text("learning_objectives").array(),
		metadata: jsonb("metadata").default({}),
		isActive: boolean("is_active").default(true),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		index("idx_topics_subject").on(t.subjectId),
		index("idx_topics_grade").on(t.grade),
		index("idx_topics_subject_grade").on(t.subjectId, t.grade),
		index("idx_topics_unit").on(t.subjectId, t.unitNumber),
		index("idx_topics_chapter").on(t.subjectId, t.unitNumber, t.chapterNumber),
	],
);
