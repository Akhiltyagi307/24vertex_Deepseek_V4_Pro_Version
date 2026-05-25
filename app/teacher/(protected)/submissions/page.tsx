import type { Metadata } from "next";
import { Suspense } from "react";

import { TeacherSubmissionsPage } from "./teacher-submissions-page";
import { loadTeacherSubmissionAssignmentBundles } from "@/lib/assignments/teacher-submissions-hub";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Submissions",
	robots: { index: false, follow: false },
};

export default async function TeacherSubmissionsRoutePage() {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user } = session;

	const submissionBundles = await loadTeacherSubmissionAssignmentBundles(user.id);

	return (
		<Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground text-sm">Loading submissions…</div>}>
			<TeacherSubmissionsPage submissionBundles={submissionBundles} />
		</Suspense>
	);
}
