import type { Metadata } from "next";

import { TeacherAccountSettingsForm } from "./teacher-account-settings-form";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import {
	getActiveTeacherOrganizationSnapshot,
	listActiveTeacherLinkedStudentProfiles,
	listCatalogOrganizations,
} from "@/lib/organizations/queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

// Authenticated teacher settings include organization/roster-sensitive state and should not be statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Teacher settings",
	robots: { index: false, follow: false },
};

export default async function TeacherSettingsPage() {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user, profile } = session;

	const [catalog, activeOrganization, subjectsCatalog] = await Promise.all([
		listCatalogOrganizations(),
		getActiveTeacherOrganizationSnapshot(user.id),
		listActiveSubjectsCatalog(),
	]);

	const independentLinkedStudents = activeOrganization
		? null
		: await listActiveTeacherLinkedStudentProfiles(user.id);

	return (
		<TeacherAccountSettingsForm
			userId={user.id}
			loginEmail={user.email ?? ""}
			profile={{
				full_name: profile.full_name,
				avatar_url: profile.avatar_url,
				phone: profile.phone,
				teacher_roster_grade: profile.teacher_roster_grade,
				teacher_roster_subject_id: profile.teacher_roster_subject_id,
			}}
			organizations={catalog}
			activeOrganization={activeOrganization}
			subjectsCatalog={subjectsCatalog}
			orgStudentRoster={null}
			independentLinkedStudents={independentLinkedStudents}
		/>
	);
}
