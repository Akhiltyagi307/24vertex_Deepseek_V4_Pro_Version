import type { Metadata } from "next";

import { TeacherAccountSettingsForm } from "./teacher-account-settings-form";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import {
	getActiveTeacherOrganizationSnapshot,
	listActiveTeacherLinkedStudentProfiles,
	listCatalogOrganizations,
} from "@/lib/organizations/queries";
import { listTeacherScopedSubjectsCatalog } from "@/lib/teachers/teacher-subject-scope";

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

	const [catalog, activeOrganization] = await Promise.all([
		listCatalogOrganizations(),
		getActiveTeacherOrganizationSnapshot(user.id),
	]);
	// Org-students roster filter shows only the teacher's taught subjects (full catalog when unscoped).
	const subjectsCatalog = await listTeacherScopedSubjectsCatalog({
		activeOrganizationId: activeOrganization?.id ?? null,
		subjectsTaught: profile.subjects_taught,
	});

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
			}}
			organizations={catalog}
			activeOrganization={activeOrganization}
			subjectsCatalog={subjectsCatalog}
			orgStudentRoster={null}
			independentLinkedStudents={independentLinkedStudents}
		/>
	);
}
