import "server-only";

import { unstable_cache } from "next/cache";
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

/**
 * Cache tag for the active-subjects catalog. Any admin mutation that changes the
 * subjects table (create/edit/activate/reorder) must call
 * `revalidateTag(SUBJECTS_CATALOG_CACHE_TAG)` so cached readers refresh immediately
 * instead of waiting out the `revalidate` window.
 */
export const SUBJECTS_CATALOG_CACHE_TAG = "subjects-catalog";

async function loadActiveSubjectsCatalog(): Promise<SubjectCatalogRow[]> {
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

/**
 * Active subjects for grade-based dropdowns (teacher roster filters).
 *
 * Cached because the subjects catalog is global (not user-scoped) and changes
 * rarely, but was previously re-queried from the DB on every teacher page render
 * — a cross-region round-trip each time. The result is plain, JSON-serializable
 * rows, so it is safe to memoize via `unstable_cache`. Invalidated on a 5-minute
 * window and by tag on admin subject mutations.
 *
 * The `unstable_cache` wrapper is built inside the function (not at module top
 * level) so importing this module never touches `next/cache` — matching
 * `getCachedTopicCountsBySubjectForGrade` and keeping unit tests that partial-mock
 * `next/cache` working. The static cache key means every call shares one entry.
 */
export async function listActiveSubjectsCatalog(): Promise<SubjectCatalogRow[]> {
	return unstable_cache(loadActiveSubjectsCatalog, ["active-subjects-catalog"], {
		revalidate: 300,
		tags: [SUBJECTS_CATALOG_CACHE_TAG],
	})();
}
