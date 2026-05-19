// KaTeX CSS is loaded only on student-portal pages (where the doubt-chat
// tutor renders LaTeX). Public/marketing/login pages don't need it, so we
// avoid the ~25KB on cold loads outside the authenticated surface.
import "katex/dist/katex.min.css";
import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AuthSignedOutListener } from "@/components/auth/auth-signed-out-listener";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { StudentShell } from "@/components/student/student-shell";
import { SubscriptionBanner } from "@/components/student/subscription/subscription-banner";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";
import { mapAppProfileToStudentLayoutContext } from "@/lib/auth/student-layout";
import { getCachedEntitlements } from "@/lib/billing/entitlements";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
function gradeLabel(grade: number | null, section: string | null) {
	if (grade == null) return "Student";
	const sec = section ? ` · ${section}` : "";
	return `Grade ${grade}${sec}`;
}

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
	const [{ user, profile: row }, entitlement] = await Promise.all([
		requireVerifiedStudent(),
		getCachedEntitlements(),
	]);

	const ctx = mapAppProfileToStudentLayoutContext(row, user.email);

	const org = ctx.schoolName?.trim() || "Your school";
	const displayName = formatPersonDisplayName(ctx.fullName ?? "") || "Student";

	return (
		<>
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
		>
			<SubscriptionBanner entitlement={entitlement} />
			{children}
		</StudentShell>
		</>
	);
}
