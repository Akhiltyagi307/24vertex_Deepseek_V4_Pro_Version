import { redirect } from "next/navigation";
import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { StudentShell } from "@/components/student/student-shell";
import { SubscriptionBanner } from "@/components/student/subscription/subscription-banner";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { mapAppProfileToStudentLayoutContext } from "@/lib/auth/student-layout";
import { getCachedEntitlements } from "@/lib/billing/entitlements";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
function gradeLabel(grade: number | null, section: string | null) {
	if (grade == null) return "Student";
	const sec = section ? ` · ${section}` : "";
	return `Grade ${grade}${sec}`;
}

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const [row, entitlement] = await Promise.all([getCachedAppProfileRow(), getCachedEntitlements()]);
	if (!row || row.role !== "student") {
		redirect("/login");
	}
	if (row.is_suspended) {
		redirect("/login?suspended=1");
	}

	const ctx = mapAppProfileToStudentLayoutContext(row, user.email);

	const org = ctx.schoolName?.trim() || "Your school";
	const displayName = formatPersonDisplayName(ctx.fullName ?? "") || "Student";

	return (
		<>
			<SkipToContent />
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
