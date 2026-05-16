import { redirect } from "next/navigation";

import { TeacherTopicPerformanceDirectoryPanel } from "./teacher-topic-performance-directory-panel";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { getTeacherPerformanceDirectoryFilterOptions } from "@/lib/teachers/teacher-performance-directory-queries";
import { listTeacherTopicPerformanceRows } from "@/lib/teachers/teacher-topic-performance-queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

export const dynamic = "force-dynamic";

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function TeacherTopicPerformancePage({ searchParams }: PageProps) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "teacher") {
		redirect("/login");
	}
	if (!profile.is_verified) {
		redirect("/teacher/pending");
	}

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
