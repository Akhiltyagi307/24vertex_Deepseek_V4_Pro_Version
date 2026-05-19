import { Suspense } from "react";

import { StudentPracticeAsync } from "./student-practice-async";
import { StudentPracticeSkeleton } from "./student-practice-skeleton";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";
import { studentHubPageShellClassName } from "@/lib/student/student-hub-page-layout";

export const dynamic = "force-dynamic";

export const metadata = { title: "Practice" };

export default async function StudentPracticePage() {
	const { user, profile: row } = await requireVerifiedStudent();

	const profileRow = {
		grade: row.grade,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
	};

	return (
		<div className={studentHubPageShellClassName}>
			<Suspense fallback={<StudentPracticeSkeleton />}>
				<StudentPracticeAsync userId={user.id} profileRow={profileRow} />
			</Suspense>
		</div>
	);
}
