import { redirect } from "next/navigation";

import { ParentShell } from "@/components/parent/parent-shell";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { hasOpenAssignmentsForStudent } from "@/lib/assignments/has-open-assignments";
import { getCachedEntitlementsForProfile } from "@/lib/billing/entitlements";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { getStudentUnreadCount } from "@/lib/notifications/student-queries";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

function gradeLabel(grade: number | null, section: string | null): string {
	if (grade == null) return "Child account";
	const sec = section ? ` · ${section}` : "";
	return `Grade ${grade}${sec}`;
}

/** Parents created within this many days see the first-run onboarding (mirrors the teacher window). */
const PARENT_ONBOARDING_WINDOW_DAYS = 30;

function isWithinParentOnboardingWindow(createdAtIso: string | null): boolean {
	if (!createdAtIso) return false;
	const created = Date.parse(createdAtIso);
	if (Number.isNaN(created)) return false;
	const windowMs = PARENT_ONBOARDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	return Date.now() - created <= windowMs;
}

export default async function ParentPortalLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const parentRow = await getCachedAppProfileRow();
	if (!parentRow || parentRow.role !== "parent") {
		redirect("/login");
	}

	const activeId = await getParentActiveStudentIdFromCookie();
	if (!activeId) {
		redirect("/parent/select-student");
	}

	// Link assertion and child-profile read both key off `activeId` and don't
	// depend on each other — run them concurrently to save a DB round-trip on
	// every parent page load. We still check `linked` before trusting the row.
	const supabase = await createClient();
	const [linked, childResult] = await Promise.all([
		assertParentActiveLink(user.id, activeId),
		supabase
			.from("profiles")
			.select("id, full_name, school_name, grade, section, student_link_code, role")
			.eq("id", activeId)
			.maybeSingle(),
	]);

	if (!linked) {
		redirect("/parent/select-student");
	}

	const childRow = childResult.data;
	if (!childRow || childRow.role !== "student") {
		redirect("/parent/select-student");
	}

	const [entitlement, initialHasOpenAssignments, initialUnreadCount] = await Promise.all([
		getCachedEntitlementsForProfile(activeId),
		hasOpenAssignmentsForStudent(activeId).catch(() => false),
		getStudentUnreadCount(supabase, user.id).catch((err) => {
			logSupabaseError("parent.layout.unread_count", err as { message?: string }, {
				userId: user.id,
			});
			return 0;
		}),
	]);

	const org = childRow.school_name?.trim() || "Your school";
	const childName = formatPersonDisplayName(childRow.full_name ?? "") || "Your child";
	const parentName = formatPersonDisplayName(parentRow.full_name ?? "") || "Parent";

	// First-run onboarding gate: parents created within the window. The welcome
	// flag (client-side) is the secondary guard so the flow never re-shows.
	const isNewParent = isWithinParentOnboardingWindow(parentRow.created_at);
	const parentFirstName = formatPersonDisplayName(parentRow.full_name ?? "").split(/\s+/)[0] || null;

	return (
		<ParentShell
			organizationName={org}
			childDisplayName={childName}
			childLinkCode={childRow.student_link_code}
			parentUserId={user.id}
			parentDisplayName={parentName}
			parentEmail={user.email ?? ""}
			parentAvatarUrl={parentRow.avatar_url}
			childGradeLabel={gradeLabel(childRow.grade, childRow.section)}
			entitlement={entitlement}
			initialHasOpenAssignments={initialHasOpenAssignments}
			initialUnreadCount={initialUnreadCount}
			isNewParent={isNewParent}
			parentFirstName={parentFirstName}
		>
			{children}
		</ParentShell>
	);
}
