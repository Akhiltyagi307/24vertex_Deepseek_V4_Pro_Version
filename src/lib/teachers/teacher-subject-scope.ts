import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";
import type { SubjectCatalogRow } from "@/lib/teachers/subject-catalog-label";

/**
 * A teacher's teaching scope, derived from `profiles.subjects_taught`.
 *
 * `isScoped` is true only for an org teacher who has chosen subjects. When scoped,
 * `grades` is the distinct, sorted set of grades of those taught *active* subjects
 * (a grade appears even if no student is enrolled in it yet), and `subjectIds` is
 * the taught active subject ids. Unscoped (independent / link-code teachers, or an
 * org teacher with an empty `subjects_taught`) means "whole school" — no restriction.
 */
export type TeacherSubjectScope = {
	isScoped: boolean;
	subjectIds: string[];
	grades: number[];
};

export type TeacherSubjectScopeInput = {
	activeOrganizationId: string | null;
	subjectsTaught: string[] | null;
};

const UNSCOPED: TeacherSubjectScope = { isScoped: false, subjectIds: [], grades: [] };

/** A filter selection where `"all"` means "no restriction". */
export type ScopedFilterSelection = {
	grade: number | "all";
	subjectId: string | "all";
};

/**
 * Resolve a teacher's subject scope. Scoped only when the teacher has an active
 * organization AND a non-empty `subjectsTaught`. When scoped we read the taught
 * subjects' grades from the live catalog (active only), so a deactivated subject
 * neither contributes a grade nor counts as in-scope.
 */
export async function getTeacherSubjectScope(
	input: TeacherSubjectScopeInput,
): Promise<TeacherSubjectScope> {
	const taught = [...new Set((input.subjectsTaught ?? []).filter(Boolean))];
	if (input.activeOrganizationId == null || taught.length === 0) {
		return UNSCOPED;
	}

	const rows = await db
		.select({ id: subjects.id, grade: subjects.grade })
		.from(subjects)
		.where(and(eq(subjects.isActive, true), inArray(subjects.id, taught)))
		.orderBy(asc(subjects.grade));

	// Non-empty subjects_taught but none currently active → stay scoped with an
	// empty allow-list (fail-closed): filters clamp to "all" and the grade bound
	// becomes empty, so no foreign-grade/subject data leaks through.
	const subjectIds = rows.map((r) => r.id);
	const grades = [...new Set(rows.map((r) => r.grade).filter((g): g is number => g != null))].sort(
		(a, b) => a - b,
	);
	return { isScoped: true, subjectIds, grades };
}

/** Intersect an already-loaded catalog with a resolved scope (pure; full catalog when unscoped). */
export function filterSubjectsCatalogToScope(
	scope: TeacherSubjectScope,
	catalog: SubjectCatalogRow[],
): SubjectCatalogRow[] {
	if (!scope.isScoped) return catalog;
	const allow = new Set(scope.subjectIds);
	return catalog.filter((s) => allow.has(s.id));
}

/**
 * The subject catalog for a teacher's filter dropdowns: the full active catalog
 * when unscoped, else the catalog intersected with the teacher's taught subjects.
 */
export async function listTeacherScopedSubjectsCatalog(
	input: TeacherSubjectScopeInput,
): Promise<SubjectCatalogRow[]> {
	const [catalog, scope] = await Promise.all([listActiveSubjectsCatalog(), getTeacherSubjectScope(input)]);
	return filterSubjectsCatalogToScope(scope, catalog);
}

/**
 * Clamp a grade/subject filter selection back to `"all"` when it falls outside the
 * teacher's scope. No-op when unscoped. `"all"` always passes through.
 */
export function coerceFiltersToScope(
	scope: TeacherSubjectScope,
	filters: ScopedFilterSelection,
): ScopedFilterSelection {
	if (!scope.isScoped) return filters;
	const gradeInScope = filters.grade === "all" || scope.grades.includes(filters.grade);
	const subjectInScope =
		filters.subjectId === "all" || scope.subjectIds.includes(filters.subjectId);
	return {
		grade: gradeInScope ? filters.grade : "all",
		subjectId: subjectInScope ? filters.subjectId : "all",
	};
}

/** True only when the teacher is scoped and the subject is not one they teach. */
export function isSubjectOutOfScope(scope: TeacherSubjectScope, subjectId: string): boolean {
	return scope.isScoped && !scope.subjectIds.includes(subjectId);
}
