import { redirect } from "next/navigation";

import { TeacherPerformanceDirectoryPanel } from "./teacher-performance-directory-panel";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import {
	getTeacherPerformanceDirectoryFilterOptions,
	listTeacherPerformanceDirectoryStudents,
} from "@/lib/teachers/teacher-performance-directory-queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

export const dynamic = "force-dynamic";

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function TeacherStudentPerformanceDirectoryPage({ searchParams }: PageProps) {
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

	const initialRows = await listTeacherPerformanceDirectoryStudents({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		subjectId: initialSubjectId === "all" ? undefined : initialSubjectId,
	});

	const workspaceDescription = activeOrg
		? `Review subject-level performance for students at ${activeOrg.name} that your teacher account can reach. Filter by grade, section, or subject (grades 11–12 respect stream and elective), then open a student to see detailed progress—the same subject view families see in the parent portal.`
		: `Review subject-level performance for students linked to your account with a six-character code while you’re outside an organization. Filter by class placement or subject, then open a student to see detailed progress—the same subject view families see in the parent portal.`;

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
