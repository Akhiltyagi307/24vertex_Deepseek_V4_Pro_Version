"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { ParentAppSidebar } from "@/components/parent/parent-app-sidebar";
import { StudentTopBar } from "@/components/student/student-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

function isParentDoubtChatPath(pathname: string): boolean {
	return pathname === "/parent/doubt-chat";
}

export type ParentShellProps = {
	organizationName: string;
	/** Child — shown in header trail. */
	childDisplayName: string;
	childLinkCode?: string | null;
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
	parentDisplayName,
	parentEmail,
	parentAvatarUrl,
	childGradeLabel,
	entitlement,
	children,
}: ParentShellProps) {
	const pathname = usePathname();
	const doubtChat = isParentDoubtChatPath(pathname);

	return (
		<SidebarProvider
			className={cn(
				"flex w-full flex-col",
				doubtChat ? "h-dvh max-h-dvh min-h-0 overflow-hidden" : "min-h-svh",
			)}
		>
			<StudentTopBar
				organizationName={organizationName}
				userDisplayName={childDisplayName}
				shareableId={childLinkCode}
			/>
			<div
				className={cn(
					"flex min-h-0 w-full min-w-0 flex-1",
					doubtChat && "overflow-hidden",
				)}
			>
				<ParentAppSidebar
					user={{
						name: parentDisplayName,
						email: parentEmail,
						avatar: parentAvatarUrl,
					}}
					childGradeLabel={childGradeLabel}
					entitlement={entitlement}
				/>
				<SidebarInset
					className={
						doubtChat
							? "min-h-0 min-w-0 flex-1 overflow-hidden bg-background"
							: "min-h-0 flex-1 overflow-auto bg-background"
					}
				>
					{children}
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
