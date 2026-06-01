import { redirect } from "next/navigation";

import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AuthSignedOutListener } from "@/components/auth/auth-signed-out-listener";
import { NonceProviders } from "@/components/nonce-providers";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";

/** Teachers created within this many days see the first-run onboarding (wider than students' to span the approval wait). */
const TEACHER_ONBOARDING_WINDOW_DAYS = 30;

function isWithinTeacherOnboardingWindow(createdAtIso: string | null): boolean {
	if (!createdAtIso) return false;
	const created = Date.parse(createdAtIso);
	if (Number.isNaN(created)) return false;
	const windowMs = TEACHER_ONBOARDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	return Date.now() - created <= windowMs;
}

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

	// First-run onboarding gate: verified teachers created within the window. The
	// window is wider than students' (teachers may sit in "pending" awaiting admin
	// approval before they ever reach the verified workspace).
	const isNewTeacher =
		(row.is_verified ?? false) &&
		row.onboarding_welcome_seen_at == null &&
		isWithinTeacherOnboardingWindow(row.created_at);
	const onboardingFirstName = formatPersonDisplayName(row.full_name ?? "").split(/\s+/)[0] || null;

	return (
		<NonceProviders>
			<SkipToContent />
			<AuthSignedOutListener />
			<AdminImpersonationBanner />
			<TeacherShell
				organizationName={organizationName}
				hasOrganization={teacherOrg != null}
				userDisplayName={displayName}
				contextLabel={contextLabel}
				email={user.email ?? ""}
				avatarUrl={row.avatar_url}
				isNewTeacher={isNewTeacher}
				onboardingFirstName={onboardingFirstName}
			>
				{children}
			</TeacherShell>
		</NonceProviders>
	);
}
