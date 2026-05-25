import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AuthSignedOutListener } from "@/components/auth/auth-signed-out-listener";
import { NonceProviders } from "@/components/nonce-providers";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { StudentShell } from "@/components/student/student-shell";
import { SubscriptionBanner } from "@/components/student/subscription/subscription-banner";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";
import { mapAppProfileToStudentLayoutContext } from "@/lib/auth/student-layout";
import { getCachedEntitlements } from "@/lib/billing/entitlements";
import { hasOpenAssignmentsForStudent } from "@/lib/assignments/has-open-assignments";
import { getStudentUnreadCount } from "@/lib/notifications/student-queries";
import { getStudentActivityStreakSnapshot } from "@/lib/student/activity-streak";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
function gradeLabel(grade: number | null, section: string | null) {
	if (grade == null) return "Student";
	const sec = section ? ` · ${section}` : "";
	return `Grade ${grade}${sec}`;
}

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
	const { user, profile: row } = await requireVerifiedStudent();
	const supabase = await createClient();

	let activityStreak = null;
	let initialUnreadCount = 0;

	const [entitlement, initialHasOpenAssignments, streakResult, unreadResult] = await Promise.all([
		getCachedEntitlements(),
		hasOpenAssignmentsForStudent(user.id).catch(() => false),
		getStudentActivityStreakSnapshot(supabase, user.id).catch((err) => {
			logSupabaseError("student.layout.activity_streak", err as { message?: string }, {
				userId: user.id,
			});
			return null;
		}),
		getStudentUnreadCount(supabase, user.id).catch((err) => {
			logSupabaseError("student.layout.unread_count", err as { message?: string }, {
				userId: user.id,
			});
			return 0;
		}),
	]);

	activityStreak = streakResult;
	initialUnreadCount = unreadResult;

	const ctx = mapAppProfileToStudentLayoutContext(row, user.email);

	const org = ctx.schoolName?.trim() || "Your school";
	const displayName = formatPersonDisplayName(ctx.fullName ?? "") || "Student";

	return (
		<NonceProviders>
			<SkipToContent />
			<AuthSignedOutListener />
			<AdminImpersonationBanner />
			<StudentShell
			organizationName={org}
			userDisplayName={displayName}
			shareableId={ctx.studentLinkCode}
			email={ctx.email}
			avatarUrl={ctx.avatarUrl}
			gradeLabel={gradeLabel(ctx.grade, ctx.section)}
			entitlement={entitlement}
			userId={user.id}
			initialHasOpenAssignments={initialHasOpenAssignments}
			initialUnreadCount={initialUnreadCount}
			activityStreak={activityStreak}
		>
			<SubscriptionBanner entitlement={entitlement} />
			{children}
		</StudentShell>
		</NonceProviders>
	);
}
