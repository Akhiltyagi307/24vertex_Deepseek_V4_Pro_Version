import { redirect } from "next/navigation";

import { TeacherAccountSettingsForm } from "./teacher-account-settings-form";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import {
	getActiveTeacherOrganizationSnapshot,
	listActiveTeacherLinkedStudentProfiles,
	listCatalogOrganizations,
} from "@/lib/organizations/queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

// Authenticated teacher settings include organization/roster-sensitive state and should not be statically cached.
export const dynamic = "force-dynamic";

export default async function TeacherSettingsPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "teacher") redirect("/login");
	if (!profile.is_verified) redirect("/teacher/pending");

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
