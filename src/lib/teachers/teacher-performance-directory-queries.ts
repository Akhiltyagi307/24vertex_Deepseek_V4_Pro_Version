import "server-only";

import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { teacherStudentLinks } from "@/db/schema/organizations";
import { profiles } from "@/db/schema/profiles";
import {
	getOrganizationRosterFilterOptions,
	listOrganizationStudentsWithFilters,
	type OrganizationRosterFilterOptions,
	type OrganizationRosterStudentRow,
} from "@/lib/teachers/roster-queries";

export type TeacherPerformanceStudentRow = OrganizationRosterStudentRow;

function mapRows(
	rows: {
		id: string;
		fullName: string;
		grade: number | null;
		section: string | null;
		studentLinkCode: string | null;
	}[],
): TeacherPerformanceStudentRow[] {
	return rows.map((r) => ({
		id: r.id,
		fullName: r.fullName,
		grade: r.grade,
		section: r.section,
		studentLinkCode: r.studentLinkCode,
	}));
}

const independentLinkWhereBase = (teacherId: string) =>
	and(
		eq(teacherStudentLinks.teacherId, teacherId),
		eq(teacherStudentLinks.status, "active"),
		eq(profiles.role, "student"),
		isNull(profiles.deletedAt),
	);

/** Org roster or independent link-code students, with optional placement/subject filters. */
export async function listTeacherPerformanceDirectoryStudents(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	grade?: number | null;
	section?: string | null;
	subjectId?: string | null;
}): Promise<TeacherPerformanceStudentRow[]> {
	if (params.activeOrganizationId) {
		return listOrganizationStudentsWithFilters({
			organizationId: params.activeOrganizationId,
			grade: params.grade ?? undefined,
			section: params.section ?? undefined,
			subjectId: params.subjectId ?? undefined,
		});
	}

	const conditions = [independentLinkWhereBase(params.teacherId)];

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
		.from(teacherStudentLinks)
		.innerJoin(profiles, eq(profiles.id, teacherStudentLinks.studentId))
		.where(and(...conditions))
		.orderBy(asc(profiles.grade), asc(profiles.section), asc(profiles.fullName));

	return mapRows(rows);
}

async function getIndependentTeacherPerformanceFilterOptions(
	teacherId: string,
): Promise<OrganizationRosterFilterOptions> {
	const base = independentLinkWhereBase(teacherId);

	const gradeRows = await db
		.select({ grade: profiles.grade })
		.from(teacherStudentLinks)
		.innerJoin(profiles, eq(profiles.id, teacherStudentLinks.studentId))
		.where(and(base, isNotNull(profiles.grade)))
		.groupBy(profiles.grade)
		.orderBy(asc(profiles.grade));

	const sectionRows = await db
		.select({ section: profiles.section })
		.from(teacherStudentLinks)
		.innerJoin(profiles, eq(profiles.id, teacherStudentLinks.studentId))
		.where(and(base, isNotNull(profiles.section)))
		.groupBy(profiles.section)
		.orderBy(asc(profiles.section));

	const grades = gradeRows.map((r) => r.grade).filter((g): g is number => g != null);
	const sections = sectionRows
		.map((r) => r.section?.trim())
		.filter((s): s is string => Boolean(s && s.length > 0));

	return { grades, sections };
}

export async function getTeacherPerformanceDirectoryFilterOptions(params: {
	activeOrganizationId: string | null;
	teacherId: string;
}): Promise<OrganizationRosterFilterOptions> {
	if (params.activeOrganizationId) {
		return getOrganizationRosterFilterOptions(params.activeOrganizationId);
	}
	return getIndependentTeacherPerformanceFilterOptions(params.teacherId);
}
