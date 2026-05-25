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

	const linked = await assertParentActiveLink(user.id, activeId);
	if (!linked) {
		redirect("/parent/select-student");
	}

	const supabase = await createClient();
	const { data: childRow } = await supabase
		.from("profiles")
		.select("id, full_name, school_name, grade, section, student_link_code, role")
		.eq("id", activeId)
		.maybeSingle();

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
		>
			{children}
		</ParentShell>
	);
}
