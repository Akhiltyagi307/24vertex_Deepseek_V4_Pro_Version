"use client";

import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ParentOnboarding } from "@/components/onboarding/parent-onboarding";
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
	initialHasOpenAssignments?: boolean;
	initialUnreadCount?: number;
	/** True for recently-created parents — gates the first-run onboarding flow. */
	isNewParent?: boolean;
	/** Parent first name for the onboarding greeting. */
	parentFirstName?: string | null;
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
	initialHasOpenAssignments = false,
	initialUnreadCount = 0,
	isNewParent = false,
	parentFirstName,
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
					initialUnreadCount={initialUnreadCount}
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
					initialHasOpenAssignments={initialHasOpenAssignments}
				/>
			}
		>
			<ParentOnboarding isNewParent={isNewParent} firstName={parentFirstName} />
			{children}
		</DashboardShell>
	);
}
