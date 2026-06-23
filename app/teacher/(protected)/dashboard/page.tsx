import type { Metadata } from "next";

import { loadTeacherDashboardBundleForTeacher } from "./teacher-dashboard-data";
import { TeacherDashboardPanel } from "./teacher-dashboard-panel";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import {
	getActiveTeacherOrganizationSnapshot,
	listActiveTeacherLinkedStudentProfiles,
} from "@/lib/organizations/queries";
import { getTeacherPerformanceDirectoryFilterOptions } from "@/lib/teachers/teacher-performance-directory-queries";
import {
	AT_RISK_LAST_GRADED_COUNT,
	AT_RISK_SCORE_THRESHOLD_PERCENT,
} from "@/lib/teachers/teacher-at-risk-queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";
import { filterSubjectsCatalogToScope, getTeacherSubjectScope } from "@/lib/teachers/teacher-subject-scope";
import { lookupClassInsightOnly } from "@/lib/teachers/teacher-class-insight-service";

export const metadata: Metadata = {
	title: "Teacher dashboard",
	robots: { index: false, follow: false },
};

export default async function TeacherDashboardPage() {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const teacherId = session.user.id;

	const activeOrganization = await getActiveTeacherOrganizationSnapshot(teacherId);
	const scope = await getTeacherSubjectScope({
		activeOrganizationId: activeOrganization?.id ?? null,
		subjectsTaught: session.profile.subjects_taught,
	});
	const gradesInScope = scope.isScoped ? scope.grades : undefined;
	const linkCodeStudents = activeOrganization
		? []
		: await listActiveTeacherLinkedStudentProfiles(teacherId);

	const [subjectsCatalogAll, filterOptions, initialDashboardBundle] = await Promise.all([
		listActiveSubjectsCatalog(),
		getTeacherPerformanceDirectoryFilterOptions({
			teacherId,
			activeOrganizationId: activeOrganization?.id ?? null,
			gradesInScope,
		}),
		loadTeacherDashboardBundleForTeacher({
			teacherId,
			activeOrganizationId: activeOrganization?.id ?? null,
			filters: { grade: "all", section: "all", subjectId: "all" },
			gradesInScope,
		}),
	]);
	const subjectsCatalog = filterSubjectsCatalogToScope(scope, subjectsCatalogAll);

	const initialInsightLookup = await lookupClassInsightOnly({
		teacherUserId: teacherId,
		scope: { grade: null, section: null, subjectId: null },
		summary: initialDashboardBundle.summary,
	});

	return (
		<TeacherDashboardPanel
			activeOrganization={activeOrganization ? { name: activeOrganization.name } : null}
			linkCodeStudents={linkCodeStudents}
			subjectsCatalog={subjectsCatalog}
			filterOptions={filterOptions}
			initialDashboardBundle={initialDashboardBundle}
			initialInsightLookup={initialInsightLookup}
			atRiskThresholdPercent={AT_RISK_SCORE_THRESHOLD_PERCENT}
			atRiskLastGradedCount={AT_RISK_LAST_GRADED_COUNT}
		/>
	);
}
