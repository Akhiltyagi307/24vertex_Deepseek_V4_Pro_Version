import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentPracticeView } from "@/components/student/student-practice-view";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { loadStudentPracticePagePayload } from "@/lib/practice/load-student-practice-page";
import { createClient } from "@/lib/supabase/server";

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

	const supabase = await createClient();
	const practicePayload = await loadStudentPracticePagePayload(supabase, user.id, {
		grade: row.grade,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
	});

	return (
		<div className="w-full min-w-0">
			<Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading practice…</div>}>
				<StudentPracticeView {...practicePayload} />
			</Suspense>
		</div>
	);
}
