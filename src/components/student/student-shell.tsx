"use client";

import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StudentAppSidebar } from "@/components/student/student-app-sidebar";
import { StudentTopBar } from "@/components/student/student-top-bar";
import { PaywallProvider } from "@/components/student/subscription/paywall-dialog";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import type { StudentActivityStreakSnapshot } from "@/lib/student/activity-streak";
import {
	isStudentDoubtChatPath,
	isStudentImmersiveShellPath,
	isStudentPracticeTestSessionPath,
} from "@/lib/navigation/shell-immersive-paths";

export type StudentShellProps = {
	organizationName: string;
	userDisplayName: string;
	shareableId?: string | null;
	email: string;
	avatarUrl: string | null;
	gradeLabel: string;
	entitlement: EntitlementSnapshot | null;
	/** Auth user id — used to subscribe the top-bar bell to Realtime inserts. */
	userId?: string | null;
	initialHasOpenAssignments?: boolean;
	activityStreak?: StudentActivityStreakSnapshot | null;
	children: React.ReactNode;
};

export function StudentShell({
	organizationName,
	userDisplayName,
	shareableId,
	email,
	avatarUrl,
	gradeLabel,
	entitlement,
	userId,
	initialHasOpenAssignments = false,
	activityStreak = null,
	children,
}: StudentShellProps) {
	return (
		<PaywallProvider>
			<DashboardShell
				isDoubtChatPath={isStudentDoubtChatPath}
				isFixedViewportShellPath={isStudentPracticeTestSessionPath}
				isSidebarHiddenPath={isStudentPracticeTestSessionPath}
				isImmersiveShellPath={isStudentImmersiveShellPath}
				topBar={
					<StudentTopBar
						organizationName={organizationName}
						userDisplayName={userDisplayName}
						shareableId={shareableId}
						userId={userId ?? null}
						activityStreak={activityStreak}
					/>
				}
				sidebar={
					<StudentAppSidebar
						user={{
							name: userDisplayName,
							email,
							avatar: avatarUrl,
						}}
						gradeLabel={gradeLabel}
						entitlement={entitlement}
						userId={userId ?? null}
						initialHasOpenAssignments={initialHasOpenAssignments}
					/>
				}
			>
				{children}
			</DashboardShell>
		</PaywallProvider>
	);
}
