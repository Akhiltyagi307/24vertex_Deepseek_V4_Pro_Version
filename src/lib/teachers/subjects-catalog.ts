import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

export type SubjectCatalogRow = {
	id: string;
	name: string;
	grade: number;
};

/** Active subjects for grade-based dropdowns (teacher roster filters). */
export async function listActiveSubjectsCatalog(): Promise<SubjectCatalogRow[]> {
	const rows = await db
		.select({
			id: subjects.id,
			name: subjects.name,
			grade: subjects.grade,
		})
		.from(subjects)
		.where(and(eq(subjects.isActive, true)))
		.orderBy(asc(subjects.grade), asc(subjects.sortOrder), asc(subjects.name));

	return rows;
}
