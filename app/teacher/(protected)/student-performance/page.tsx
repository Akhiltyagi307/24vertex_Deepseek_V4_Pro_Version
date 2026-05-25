import type { Metadata } from "next";

import { TeacherPerformanceDirectoryPanel } from "./teacher-performance-directory-panel";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import {
	getTeacherPerformanceDirectoryFilterOptions,
	listTeacherPerformanceDirectoryRows,
} from "@/lib/teachers/teacher-performance-directory-queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

// Authenticated teacher student directories are roster-scoped and should not be statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Student performance",
	robots: { index: false, follow: false },
};

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function TeacherStudentPerformanceDirectoryPage({ searchParams }: PageProps) {
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

	const initialRows = await listTeacherPerformanceDirectoryRows({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		subjectId: initialSubjectId === "all" ? undefined : initialSubjectId,
	});

	const workspaceDescription = activeOrg
		? `Review subject-level performance for students at ${activeOrg.name} that your teacher account can reach. Filter by grade, section, or subject (grades 11–12 respect stream and elective), then open a student to see detailed progress. The same subject view families see in the parent portal.`
		: `Review subject-level performance for students linked to your account with a six-character code while you’re outside an organization. Filter by class placement or subject, then open a student to see detailed progress. The same subject view families see in the parent portal.`;

	return (
		<TeacherPerformanceDirectoryPanel
			workspaceDescription={workspaceDescription}
			subjectsCatalog={subjectsCatalog}
			initialRows={initialRows}
			filterOptions={filterOptions}
			initialSubjectId={initialSubjectId}
		/>
	);
}
