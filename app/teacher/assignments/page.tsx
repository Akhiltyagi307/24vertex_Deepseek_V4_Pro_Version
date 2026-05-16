import { redirect } from "next/navigation";

import { TeacherAssignmentsManager } from "./teacher-assignments-manager";
import { loadTeacherSubmissionAssignmentBundles } from "@/lib/assignments/teacher-submissions-hub";
import {
	listTeacherAssignmentSubjectCatalog,
	listTeacherAssignableStudents,
} from "@/lib/assignments/queries";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "teacher") redirect("/login");
	if (!profile.is_verified) redirect("/teacher/pending");

	const [subjectsCatalogRaw, topicsCatalog, students, submissionBundles] = await Promise.all([
		listActiveSubjectsCatalog(),
		listTeacherAssignmentSubjectCatalog(user.id),
		listTeacherAssignableStudents(user.id),
		loadTeacherSubmissionAssignmentBundles(user.id),
	]);
	const visibleSubjectIds = new Set(topicsCatalog.map((topic) => topic.subjectId));
	const subjectsCatalog = subjectsCatalogRaw.filter((subject) => visibleSubjectIds.has(subject.id));

	return (
		<TeacherAssignmentsManager
			subjectsCatalog={subjectsCatalog}
			topicsCatalog={topicsCatalog}
			students={students}
			submissionBundles={submissionBundles}
		/>
	);
}
