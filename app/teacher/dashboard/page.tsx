import { redirect } from "next/navigation";

import { TeacherDashboardPanel } from "./teacher-dashboard-panel";
import { getProfile } from "@/lib/auth/routing";
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

export default async function TeacherDashboardPage() {
	const profile = await getProfile();
	if (!profile?.is_verified) {
		redirect("/teacher/pending");
	}

	const activeOrganization = await getActiveTeacherOrganizationSnapshot(profile.id);
	const linkCodeStudents = activeOrganization
		? []
		: await listActiveTeacherLinkedStudentProfiles(profile.id);

	const [subjectsCatalog, filterOptions] = await Promise.all([
		listActiveSubjectsCatalog(),
		getTeacherPerformanceDirectoryFilterOptions({
			teacherId: profile.id,
			activeOrganizationId: activeOrganization?.id ?? null,
		}),
	]);

	return (
		<TeacherDashboardPanel
			activeOrganization={activeOrganization ? { name: activeOrganization.name } : null}
			linkCodeStudents={linkCodeStudents}
			subjectsCatalog={subjectsCatalog}
			filterOptions={filterOptions}
			atRiskThresholdPercent={AT_RISK_SCORE_THRESHOLD_PERCENT}
			atRiskLastGradedCount={AT_RISK_LAST_GRADED_COUNT}
		/>
	);
}
