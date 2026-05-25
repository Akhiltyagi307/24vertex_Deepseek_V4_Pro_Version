import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-types";

export const ASSIGNMENT_SECTION_FILTER_NONE = "__section_none__";

export type AssignmentBandFilterId = Extract<
	TeacherPerformanceBandId,
	"at_risk" | "near_target" | "needs_support"
>;

export type AssignmentBandCheckState = Record<AssignmentBandFilterId, boolean>;

export function isAssignmentBandFilterActive(checks: AssignmentBandCheckState): boolean {
	return checks.at_risk || checks.near_target || checks.needs_support;
}

export function studentMatchesAssignmentSectionFilter(
	student: Pick<TeacherPerformanceStudentRow, "section">,
	sectionFilter: string,
): boolean {
	if (!sectionFilter) return true;
	const section = (student.section ?? "").trim();
	if (sectionFilter === ASSIGNMENT_SECTION_FILTER_NONE) return section === "";
	return section === sectionFilter;
}

export function studentMatchesAssignmentBandFilter(input: {
	studentId: string;
	bandByStudentId: Record<string, TeacherPerformanceBandId | null>;
	bandChecks: AssignmentBandCheckState;
	bandsPending: boolean;
}): boolean {
	if (!isAssignmentBandFilterActive(input.bandChecks)) return true;
	if (input.bandsPending) return true;
	const band = input.bandByStudentId[input.studentId];
	if (band == null) return false;
	if (input.bandChecks.at_risk && band === "at_risk") return true;
	if (input.bandChecks.near_target && band === "near_target") return true;
	if (input.bandChecks.needs_support && band === "needs_support") return true;
	return false;
}

export function studentMatchesAssignmentRosterFilters(input: {
	student: TeacherPerformanceStudentRow;
	sectionFilter: string;
	bandByStudentId: Record<string, TeacherPerformanceBandId | null>;
	bandChecks: AssignmentBandCheckState;
	bandsPending: boolean;
}): boolean {
	return (
		studentMatchesAssignmentSectionFilter(input.student, input.sectionFilter) &&
		studentMatchesAssignmentBandFilter({
			studentId: input.student.id,
			bandByStudentId: input.bandByStudentId,
			bandChecks: input.bandChecks,
			bandsPending: input.bandsPending,
		})
	);
}

export function filterAssignmentCandidateStudents(input: {
	students: TeacherPerformanceStudentRow[];
	sectionFilter: string;
	bandByStudentId: Record<string, TeacherPerformanceBandId | null>;
	bandChecks: AssignmentBandCheckState;
	bandsPending: boolean;
}): TeacherPerformanceStudentRow[] {
	return input.students.filter((student) =>
		studentMatchesAssignmentRosterFilters({
			student,
			sectionFilter: input.sectionFilter,
			bandByStudentId: input.bandByStudentId,
			bandChecks: input.bandChecks,
			bandsPending: input.bandsPending,
		}),
	);
}

export function arrayShallowEqual<T>(a: T[], b: T[]): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}
