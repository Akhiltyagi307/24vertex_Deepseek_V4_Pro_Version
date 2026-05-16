import { redirect } from "next/navigation";

import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "teacher") {
		redirect("/login");
	}
	if (row.is_suspended) {
		redirect("/login?suspended=1");
	}

	const teacherOrg = await getActiveTeacherOrganizationSnapshot(row.id);
	const organizationName =
		teacherOrg != null
			? teacherOrg.name?.trim() || row.school_name?.trim() || "Your workspace"
			: null;
	const displayName = formatPersonDisplayName(row.full_name ?? "") || "Teacher";
	const contextLabel = teacherOrg?.type_label ?? "Teacher";

	return (
		<>
			<SkipToContent />
			<AdminImpersonationBanner />
			<TeacherShell
				organizationName={organizationName}
				userDisplayName={displayName}
				contextLabel={contextLabel}
				email={user.email ?? ""}
				avatarUrl={row.avatar_url}
			>
				{children}
			</TeacherShell>
		</>
	);
}
