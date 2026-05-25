import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

export type { SubjectCatalogRow } from "./subject-catalog-label";
export {
	buildSubjectCatalogPillSelectModel,
	formatSubjectCatalogOptionLabel,
} from "./subject-catalog-label";
export type {
	SubjectCatalogPillOption,
	SubjectCatalogPillOptionGroup,
	SubjectCatalogPillSelectModel,
} from "./subject-catalog-label";

import type { SubjectCatalogRow } from "./subject-catalog-label";

/** Active subjects for grade-based dropdowns (teacher roster filters). */
export async function listActiveSubjectsCatalog(): Promise<SubjectCatalogRow[]> {
	const rows = await db
		.select({
			id: subjects.id,
			name: subjects.name,
			grade: subjects.grade,
			stream: subjects.stream,
		})
		.from(subjects)
		.where(and(eq(subjects.isActive, true)))
		.orderBy(
			asc(subjects.grade),
			asc(subjects.stream),
			asc(subjects.sortOrder),
			asc(subjects.name),
		);

	return rows;
}
