import "server-only";

import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";
import type {
	OrganizationRosterFilterOptions,
	OrganizationRosterStudentRow,
} from "@/lib/teachers/roster-types";

export type { OrganizationRosterFilterOptions, OrganizationRosterStudentRow };

const organizationStudentBaseConditions = (organizationId: string) =>
	and(
		eq(profiles.role, "student"),
		eq(profiles.organizationId, organizationId),
		isNull(profiles.deletedAt),
	);

export async function listOrganizationStudentsForTeachingRoster(params: {
	organizationId: string;
	grade: number;
	subjectId: string;
}): Promise<OrganizationRosterStudentRow[]> {
	const rows = await db
		.select({
			id: profiles.id,
			fullName: profiles.fullName,
			grade: profiles.grade,
			section: profiles.section,
			studentLinkCode: profiles.studentLinkCode,
		})
		.from(profiles)
		.where(
			and(
				organizationStudentBaseConditions(params.organizationId),
				eq(profiles.grade, params.grade),
				sql`EXISTS (
					SELECT 1
					FROM public.get_student_subjects(${profiles.grade}, ${profiles.stream}, ${profiles.electiveSubjectId}) gs
					WHERE gs.id = ${params.subjectId}::uuid
				)`,
			),
		)
		.orderBy(asc(profiles.section), asc(profiles.fullName));

	return rows.map((r) => ({
		id: r.id,
		fullName: r.fullName,
		grade: r.grade,
		section: r.section,
		studentLinkCode: r.studentLinkCode,
	}));
}

/** Distinct grades / sections present among students in an organization (for roster filters). */
export async function getOrganizationRosterFilterOptions(
	organizationId: string,
): Promise<OrganizationRosterFilterOptions> {
	const base = organizationStudentBaseConditions(organizationId);

	const gradeRows = await db
		.select({ grade: profiles.grade })
		.from(profiles)
		.where(and(base, isNotNull(profiles.grade)))
		.groupBy(profiles.grade)
		.orderBy(asc(profiles.grade));

	const sectionRows = await db
		.select({ section: profiles.section })
		.from(profiles)
		.where(and(base, isNotNull(profiles.section)))
		.groupBy(profiles.section)
		.orderBy(asc(profiles.section));

	const grades = gradeRows.map((r) => r.grade).filter((g): g is number => g != null);
	const sections = sectionRows
		.map((r) => r.section?.trim())
		.filter((s): s is string => Boolean(s && s.length > 0));

	return { grades, sections };
}

/** Students linked to an organization, optionally narrowed by placement (grade / section) and curriculum subject. */
export async function listOrganizationStudentsWithFilters(params: {
	organizationId: string;
	grade?: number | null;
	section?: string | null;
	subjectId?: string | null;
}): Promise<OrganizationRosterStudentRow[]> {
	const conditions = [organizationStudentBaseConditions(params.organizationId)];

	if (params.grade != null) {
		conditions.push(eq(profiles.grade, params.grade));
	}

	const trimmedSection = params.section?.trim();
	if (trimmedSection) {
		conditions.push(eq(profiles.section, trimmedSection));
	}

	const sid = params.subjectId?.trim();
	if (sid) {
		conditions.push(
			sql`EXISTS (
				SELECT 1
				FROM public.get_student_subjects(${profiles.grade}, ${profiles.stream}, ${profiles.electiveSubjectId}) gs
				WHERE gs.id = ${sid}::uuid
			)`,
		);
	}

	const rows = await db
		.select({
			id: profiles.id,
			fullName: profiles.fullName,
			grade: profiles.grade,
			section: profiles.section,
			studentLinkCode: profiles.studentLinkCode,
		})
		.from(profiles)
		.where(and(...conditions))
		.orderBy(asc(profiles.grade), asc(profiles.section), asc(profiles.fullName));

	return rows.map((r) => ({
		id: r.id,
		fullName: r.fullName,
		grade: r.grade,
		section: r.section,
		studentLinkCode: r.studentLinkCode,
	}));
}
