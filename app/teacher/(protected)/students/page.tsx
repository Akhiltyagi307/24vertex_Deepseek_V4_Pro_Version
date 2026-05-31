import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TeacherIndependentStudentsPanel } from "./independent-students-panel";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { getActiveTeacherOrganizationSnapshot, listActiveTeacherLinkedStudentProfiles } from "@/lib/organizations/queries";

// Authenticated teacher rosters are organization/link-code scoped and should not be statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Linked students",
	robots: { index: false, follow: false },
};

export default async function TeacherStudentsPage() {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user } = session;

	// Code-based linking is for independent teachers only. Org teachers can't link by
	// code and view their roster under Student performance, so send them there.
	const activeOrgSnapshot = await getActiveTeacherOrganizationSnapshot(user.id);
	if (activeOrgSnapshot) {
		redirect("/teacher/student-performance");
	}

	const linkedRows = await listActiveTeacherLinkedStudentProfiles(user.id);
	return (
		<div className="mx-auto w-full max-w-3xl space-y-6 py-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Link Student</h1>
				<p className="text-sm text-muted-foreground">
					Add or remove learners with their six-character link codes while you&apos;re not connected to an organization.
				</p>
			</div>
			<TeacherIndependentStudentsPanel linkedStudents={linkedRows} />
		</div>
	);
}
