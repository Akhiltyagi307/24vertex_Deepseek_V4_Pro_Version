import type { Metadata } from "next";

import { TeacherTopicPerformanceDirectoryPanel } from "./teacher-topic-performance-directory-panel";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { getTeacherPerformanceDirectoryFilterOptions } from "@/lib/teachers/teacher-performance-directory-queries";
import { listTeacherTopicPerformanceRows } from "@/lib/teachers/teacher-topic-performance-queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

// Authenticated teacher topic analytics are roster-scoped and should not be statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Topic performance",
	robots: { index: false, follow: false },
};

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function TeacherTopicPerformancePage({ searchParams }: PageProps) {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user } = session;

	const activeOrg = await getActiveTeacherOrganizationSnapshot(user.id);

	const [subjectsCatalog, filterOptions] = await Promise.all([
		listActiveSubjectsCatalog(),
		getTeacherPerformanceDirectoryFilterOptions({
			teacherId: user.id,
			activeOrganizationId: activeOrg?.id ?? null,
		}),
	]);
	const sp = await searchParams;
	const initialSubjectId =
		sp.subject && subjectsCatalog.some((subject) => subject.id === sp.subject) ? sp.subject : "all";

	const initialRows = await listTeacherTopicPerformanceRows({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		subjectId: initialSubjectId === "all" ? undefined : initialSubjectId,
	});

	const workspaceDescription = activeOrg
		? `See how your classes are doing on individual curriculum topics at ${activeOrg.name}. Filters limit which students contribute to each average (grade, section, subject); open a topic for a per-student breakdown.`
		: `See topic-level averages for students linked with a code while you’re outside an organization. Adjust grade, section, or subject to match the cohort you’re coaching, then open a topic for student-level detail.`;

	return (
		<TeacherTopicPerformanceDirectoryPanel
			workspaceDescription={workspaceDescription}
			subjectsCatalog={subjectsCatalog}
			initialRows={initialRows}
			filterOptions={filterOptions}
			initialSubjectId={initialSubjectId}
		/>
	);
}
