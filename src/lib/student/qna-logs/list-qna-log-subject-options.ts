import "server-only";

import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";

import { db } from "@/db";

type RawSubjectOptionRow = {
	subject_id: string | null;
	subject_name: string | null;
	subject_sort_order: number | null;
};

async function fetchSubjectOptions(studentId: string) {
	const subjectRows = await db.execute(sql`
		SELECT DISTINCT
			s.id AS subject_id,
			s.name AS subject_name,
			s.sort_order AS subject_sort_order
		FROM tests t
		JOIN subjects s ON s.id = t.subject_id
		WHERE t.student_id = ${studentId}
			AND t.is_draft IS NOT TRUE
			AND t.status IN ('submitted', 'graded')
		ORDER BY s.sort_order ASC, s.name ASC
	`);

	return (subjectRows as unknown as RawSubjectOptionRow[])
		.filter((row) => row.subject_id && row.subject_name)
		.map((row) => ({
			id: String(row.subject_id),
			name: String(row.subject_name),
			sortOrder: Number(row.subject_sort_order ?? 0),
		}));
}

/** Subject filter options change rarely; cache per student for 5 minutes. */
export function listQnaLogSubjectOptions(studentId: string) {
	return unstable_cache(() => fetchSubjectOptions(studentId), ["qna-log-subject-options", studentId], {
		revalidate: 300,
	})();
}
