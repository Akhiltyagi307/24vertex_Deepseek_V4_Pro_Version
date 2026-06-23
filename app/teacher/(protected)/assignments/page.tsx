import type { Metadata } from "next";

import { AssignmentCreateSwitcher } from "./assignment-create-switcher";
import {
	listTeacherAssignmentSubjectCatalog,
	listTeacherAssignableStudents,
} from "@/lib/assignments/queries";
import { listTeacherManualDrafts } from "@/lib/assignments/manual-queries";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

// Authenticated teacher assignments include roster/submission state and should not be statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Assignments",
	robots: { index: false, follow: false },
};

export default async function TeacherAssignmentsPage() {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user } = session;

	const [subjectsCatalogRaw, topicsCatalog, students, manualDrafts] = await Promise.all([
		listActiveSubjectsCatalog(),
		listTeacherAssignmentSubjectCatalog(user.id),
		listTeacherAssignableStudents(user.id),
		listTeacherManualDrafts(user.id),
	]);
	const visibleSubjectIds = new Set(topicsCatalog.map((topic) => topic.subjectId));
	const subjectsCatalog = subjectsCatalogRaw.filter((subject) => visibleSubjectIds.has(subject.id));

	return (
		<AssignmentCreateSwitcher
			subjectsCatalog={subjectsCatalog}
			topicsCatalog={topicsCatalog}
			students={students}
			manualDrafts={manualDrafts}
		/>
	);
}
