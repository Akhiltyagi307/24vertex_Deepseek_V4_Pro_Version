"use client";

import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TeacherAppSidebar } from "@/components/teacher/teacher-app-sidebar";
import { TeacherTopBar } from "@/components/teacher/teacher-top-bar";

const neverShellPath = () => false;

export type TeacherShellProps = {
	/** Set when the teacher has an active organization membership; hides workspace segment in the top bar when null. */
	organizationName: string | null;
	userDisplayName: string;
	/** Sidebar subtitle (organization role line). */
	contextLabel: string;
	email: string;
	avatarUrl: string | null;
	children: React.ReactNode;
};

export function TeacherShell({
	organizationName,
	userDisplayName,
	contextLabel,
	email,
	avatarUrl,
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
				/>
			}
		>
			{children}
		</DashboardShell>
	);
}
