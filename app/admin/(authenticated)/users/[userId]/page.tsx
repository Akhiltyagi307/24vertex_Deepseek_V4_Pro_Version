import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminUserDangerZone } from "@/components/admin/users/admin-user-danger-zone";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { adminListPerformanceRows } from "@/lib/admin/performance-admin";
import { adminListTests } from "@/lib/admin/tests-admin";
import {
	adminListAssignmentSubmissionsForStudent,
	adminListAssignmentsForTeacher,
	adminListLinkedStudentsForParent,
	adminListNotificationsForUser,
} from "@/lib/admin/user-detail-lists";
import { getAdminUserDetailStats } from "@/lib/admin/user-detail-queries";
import { adminGetUserById } from "@/lib/admin/users-list";
import { cn } from "@/lib/utils";
import { db } from "@/db";
import { adminActionLog } from "@/db/schema/admin-action-log";
import { complianceRequests } from "@/db/schema/compliance-requests";

import { AssignmentsTab } from "./_tabs/assignments-tab";
import { AuditTab } from "./_tabs/audit-tab";
import { ComplianceTab } from "./_tabs/compliance-tab";
import { NotificationsTab } from "./_tabs/notifications-tab";
import { PerformanceTab } from "./_tabs/performance-tab";
import { ProfileTab } from "./_tabs/profile-tab";
import { SessionsTab } from "./_tabs/sessions-tab";
import { TestsTab } from "./_tabs/tests-tab";
import { USER_DETAIL_TABS, type UserDetailTab } from "./_tabs/types";

/**
 * D16: this page is intentionally a thin dispatcher. The 8 tab views live
 * in `./_tabs/`. The page resolves the user row, fans out all data fetches
 * in parallel (D23), and renders the active tab. Adding a new tab means
 * adding a `_tabs/<name>-tab.tsx`, extending `USER_DETAIL_TABS`, and
 * threading the props — no changes to the page-level JSX block beyond the
 * dispatcher switch.
 */

export const metadata = {
	title: "Admin user · 24Vertex",
	robots: { index: false, follow: false },
};

function isTab(v: string | undefined): v is UserDetailTab {
	return !!v && (USER_DETAIL_TABS as readonly string[]).includes(v);
}

export default async function AdminUserDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ userId: string }>;
	searchParams: Promise<{ tab?: string; page?: string }>;
}) {
	const { userId } = await params;
	const sp = await searchParams;
	const tab: UserDetailTab = isTab(sp.tab) ? sp.tab : "profile";
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 25;

	// D23: the user row + global feature flag resolve in parallel; the
	// tab-specific data then fans out in a single Promise.all so the
	// per-tab fetch overlaps with `getAdminUserDetailStats`.
	const [row, totpRequired] = await Promise.all([
		adminGetUserById(userId),
		isAdminTotpRequired(),
	]);
	if (!row) notFound();

	const linkedStudentsPromise =
		row.role === "parent" && tab === "profile"
			? adminListLinkedStudentsForParent(userId)
			: Promise.resolve([] as Awaited<ReturnType<typeof adminListLinkedStudentsForParent>>);
	const testsListPromise: Promise<Awaited<ReturnType<typeof adminListTests>> | null> =
		tab === "tests" && row.role === "student"
			? adminListTests({ page, pageSize, studentId: userId, status: null, q: null })
			: Promise.resolve(null);
	const studentAssignmentsPromise: Promise<
		Awaited<ReturnType<typeof adminListAssignmentSubmissionsForStudent>> | null
	> =
		tab === "assignments" && row.role === "student"
			? adminListAssignmentSubmissionsForStudent(userId, page, pageSize)
			: Promise.resolve(null);
	const teacherAssignmentsPromise: Promise<
		Awaited<ReturnType<typeof adminListAssignmentsForTeacher>> | null
	> =
		tab === "assignments" && row.role === "teacher"
			? adminListAssignmentsForTeacher(userId, page, pageSize)
			: Promise.resolve(null);
	const notificationsPromise: Promise<
		Awaited<ReturnType<typeof adminListNotificationsForUser>> | null
	> =
		tab === "notifications"
			? adminListNotificationsForUser(userId, page, pageSize)
			: Promise.resolve(null);
	const perfRowsPromise: Promise<Awaited<ReturnType<typeof adminListPerformanceRows>>> =
		tab === "performance" && row.role === "student"
			? adminListPerformanceRows(userId)
			: Promise.resolve([] as Awaited<ReturnType<typeof adminListPerformanceRows>>);
	const complianceDsrsPromise =
		tab === "compliance"
			? db
					.select()
					.from(complianceRequests)
					.where(eq(complianceRequests.subjectUserId, userId))
					.orderBy(desc(complianceRequests.createdAt))
					.limit(50)
			: Promise.resolve([] as Awaited<ReturnType<typeof db.select>> extends infer X
					? X extends unknown[]
						? X
						: never[]
					: never[]);
	const auditRowsPromise =
		tab === "audit"
			? db
					.select({
						id: adminActionLog.id,
						action: adminActionLog.action,
						targetType: adminActionLog.targetType,
						targetId: adminActionLog.targetId,
						payload: adminActionLog.payload,
						createdAt: adminActionLog.createdAt,
					})
					.from(adminActionLog)
					.where(eq(adminActionLog.targetId, userId))
					.orderBy(desc(adminActionLog.id))
					.limit(50)
			: Promise.resolve([]);

	const [
		stats,
		linkedStudents,
		testsList,
		studentAssignments,
		teacherAssignments,
		notificationsList,
		perfRowsAll,
		complianceDsrs,
		auditRows,
	] = await Promise.all([
		getAdminUserDetailStats(userId, row.role),
		linkedStudentsPromise,
		testsListPromise,
		studentAssignmentsPromise,
		teacherAssignmentsPromise,
		notificationsPromise,
		perfRowsPromise,
		complianceDsrsPromise,
		auditRowsPromise,
	]);
	const perfPreview = perfRowsAll.slice(0, 15);

	const usersListHref =
		row.role === "parent"
			? "/admin/users/parents"
			: row.role === "teacher"
				? "/admin/users/teachers"
				: "/admin/users/students";

	const tabLink = (id: UserDetailTab, label: string) => {
		const active = tab === id;
		return (
			<Link
				key={id}
				aria-current={active ? "page" : undefined}
				className={cn(
					"rounded-md border px-3 py-1.5",
					active ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted",
				)}
				href={`/admin/users/${userId}?tab=${id}`}
			>
				{label}
			</Link>
		);
	};

	const pagination = { page, pageSize };

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Users", href: usersListHref },
					{ label: row.full_name },
				]}
				title={row.full_name}
				description={row.email ?? "No email"}
			/>

			<nav aria-label="User sections" className="flex flex-wrap gap-2 text-sm">
				{tabLink("profile", "Profile")}
				{tabLink("performance", "Performance")}
				{tabLink("tests", "Tests")}
				{tabLink("assignments", "Assignments")}
				{tabLink("notifications", "Notifications")}
				{tabLink("sessions", "Sessions")}
				{tabLink("audit", "Audit log")}
				{tabLink("compliance", "Compliance")}
			</nav>

			{tab === "profile" ? (
				<ProfileTab row={row} linkedStudents={linkedStudents} />
			) : null}
			{tab === "performance" ? (
				<PerformanceTab row={row} userId={userId} perfPreview={perfPreview} stats={stats} />
			) : null}
			{tab === "tests" ? (
				<TestsTab row={row} userId={userId} testsList={testsList} pagination={pagination} />
			) : null}
			{tab === "assignments" ? (
				<AssignmentsTab
					row={row}
					userId={userId}
					studentAssignments={studentAssignments}
					teacherAssignments={teacherAssignments}
					pagination={pagination}
				/>
			) : null}
			{tab === "notifications" && notificationsList ? (
				<NotificationsTab
					userId={userId}
					notificationsList={notificationsList}
					pagination={pagination}
				/>
			) : null}
			{tab === "sessions" ? <SessionsTab userId={userId} /> : null}
			{tab === "audit" ?
				<AuditTab
					auditHref={`/admin/audit?targetId=${encodeURIComponent(userId)}`}
					sessionRevokeAuditHref={`/admin/audit?targetId=${encodeURIComponent(userId)}&action=user_sessions_revoke_all`}
					rows={auditRows.map((r) => ({
						id: r.id,
						action: r.action,
						targetType: r.targetType,
						targetId: r.targetId,
						payload: r.payload,
						createdAt: r.createdAt?.toISOString() ?? "",
					}))}
				/>
			:	null}
			{tab === "compliance" ? <ComplianceTab dsrs={complianceDsrs} /> : null}

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Danger zone</h2>
				<AdminUserDangerZone userId={row.id} email={row.email} totpRequired={totpRequired} />
			</section>
		</div>
	);
}
