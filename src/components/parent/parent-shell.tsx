"use client";

import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ParentAppSidebar } from "@/components/parent/parent-app-sidebar";
import { StudentTopBar } from "@/components/student/student-top-bar";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { isParentDoubtChatPath } from "@/lib/navigation/shell-immersive-paths";

export type ParentShellProps = {
	organizationName: string;
	/** Child — shown in header trail. */
	childDisplayName: string;
	childLinkCode?: string | null;
	/** Parent auth user id (Supabase) for notifications and account chrome. */
	parentUserId: string;
	parentDisplayName: string;
	parentEmail: string;
	parentAvatarUrl: string | null;
	childGradeLabel: string;
	entitlement: EntitlementSnapshot | null;
	children: React.ReactNode;
};

export function ParentShell({
	organizationName,
	childDisplayName,
	childLinkCode,
	parentUserId,
	parentDisplayName,
	parentEmail,
	parentAvatarUrl,
	childGradeLabel,
	entitlement,
	children,
}: ParentShellProps) {
	return (
		<DashboardShell
			isDoubtChatPath={isParentDoubtChatPath}
			isSidebarHiddenPath={isParentDoubtChatPath}
			topBar={
				<StudentTopBar
					organizationName={organizationName}
					userDisplayName={childDisplayName}
					shareableId={childLinkCode}
					headerPortal="parent"
					parentNotificationsUserId={parentUserId}
				/>
			}
			sidebar={
				<ParentAppSidebar
					user={{
						name: parentDisplayName,
						email: parentEmail,
						avatar: parentAvatarUrl,
					}}
					childGradeLabel={childGradeLabel}
					entitlement={entitlement}
				/>
			}
		>
			{children}
		</DashboardShell>
	);
}
