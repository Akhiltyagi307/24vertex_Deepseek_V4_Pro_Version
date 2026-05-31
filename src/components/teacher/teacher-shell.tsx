"use client";

import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TeacherOnboarding } from "@/components/onboarding/teacher-onboarding";
import { TeacherAppSidebar } from "@/components/teacher/teacher-app-sidebar";
import { TeacherTopBar } from "@/components/teacher/teacher-top-bar";

const neverShellPath = () => false;

export type TeacherShellProps = {
	/** Set when the teacher has an active organization membership; hides workspace segment in the top bar when null. */
	organizationName: string | null;
	/** True when the teacher belongs to an active organization; hides the code-based "Link Student" nav item. */
	hasOrganization: boolean;
	userDisplayName: string;
	/** Sidebar subtitle (organization role line). */
	contextLabel: string;
	email: string;
	avatarUrl: string | null;
	/** Gates the first-run onboarding flow (verified + recently created); see teacher layout. Defaults off (e.g. marketing mock). */
	isNewTeacher?: boolean;
	/** First name for the onboarding greeting; falls back to a neutral salutation when absent. */
	onboardingFirstName?: string | null;
	children: React.ReactNode;
};

export function TeacherShell({
	organizationName,
	hasOrganization,
	userDisplayName,
	contextLabel,
	email,
	avatarUrl,
	isNewTeacher = false,
	onboardingFirstName = null,
	children,
}: TeacherShellProps) {
	return (
		<DashboardShell
			isDoubtChatPath={neverShellPath}
			isSidebarHiddenPath={neverShellPath}
			topBar={
				<TeacherTopBar organizationName={organizationName} userDisplayName={userDisplayName} />
			}
			sidebar={
				<TeacherAppSidebar
					user={{
						name: userDisplayName,
						email,
						avatar: avatarUrl,
					}}
					contextLabel={contextLabel}
					hasOrganization={hasOrganization}
				/>
			}
		>
			{children}
			<TeacherOnboarding isNewTeacher={isNewTeacher} firstName={onboardingFirstName} />
		</DashboardShell>
	);
}
