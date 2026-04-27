import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentPracticeAsync } from "./student-practice-async";
import { StudentPracticeSkeleton } from "./student-practice-skeleton";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export default async function StudentPracticePage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
	}

	const profileRow = {
		grade: row.grade,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
	};

	return (
		<div className="w-full min-w-0">
			<Suspense fallback={<StudentPracticeSkeleton />}>
				<StudentPracticeAsync userId={user.id} profileRow={profileRow} />
			</Suspense>
		</div>
	);
}
