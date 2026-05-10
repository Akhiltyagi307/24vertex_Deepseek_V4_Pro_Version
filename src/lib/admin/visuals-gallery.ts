import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";
import { questions, tests } from "@/db/schema/assessment";

/** `questions.metadata.visual` present and not JSON null. */
const visualPresentSql = sql`(
  (${questions.metadata} ? 'visual')
  AND jsonb_typeof(${questions.metadata}->'visual') IS NOT NULL
  AND jsonb_typeof(${questions.metadata}->'visual') <> 'null'
)`;

export type AdminQuestionVisualRow = {
	id: string;
	testId: string;
	questionNumber: number;
	questionTextPreview: string;
	subjectName: string | null;
	metadata: unknown;
};

/**
 * Read-only spot-check: recent practice questions that persisted a non-null
 * `metadata.visual` (no column migration). Oldest-first by `created_at` desc.
 */
export async function adminListRecentQuestionsWithVisuals(limit: number): Promise<AdminQuestionVisualRow[]> {
	const cap = Math.min(100, Math.max(1, limit));
	const rows = await db
		.select({
			id: questions.id,
			testId: questions.testId,
			questionNumber: questions.questionNumber,
			questionText: questions.questionText,
			metadata: questions.metadata,
			subjectName: subjects.name,
		})
		.from(questions)
		.innerJoin(tests, eq(questions.testId, tests.id))
		.leftJoin(subjects, eq(tests.subjectId, subjects.id))
		.where(visualPresentSql)
		.orderBy(desc(questions.createdAt))
		.limit(cap);

	return rows.map((r) => ({
		id: r.id,
		testId: r.testId,
		questionNumber: r.questionNumber,
		questionTextPreview:
			r.questionText.length > 200 ? `${r.questionText.slice(0, 200)}…` : r.questionText,
		subjectName: r.subjectName,
		metadata: r.metadata,
	}));
}
