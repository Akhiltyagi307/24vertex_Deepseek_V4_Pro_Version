"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { ParentAppSidebar } from "@/components/parent/parent-app-sidebar";
import { StudentTopBar } from "@/components/student/student-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { isParentDoubtChatPath } from "@/lib/navigation/shell-immersive-paths";
import { cn } from "@/lib/utils";

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
	const [sidebarOpen, setSidebarOpen] = React.useState(!doubtChat);

	React.useEffect(() => {
		if (isParentDoubtChatPath(pathname)) {
			setSidebarOpen(false);
		}
	}, [pathname]);

	return (
		<SidebarProvider
			open={sidebarOpen}
			onOpenChange={setSidebarOpen}
			className={cn(
				"flex w-full flex-col",
				doubtChat ? "h-dvh max-h-dvh min-h-0 overflow-hidden" : "min-h-svh",
			)}
		>
			<StudentTopBar
				organizationName={organizationName}
				userDisplayName={childDisplayName}
				shareableId={childLinkCode}
				headerPortal="parent"
			/>
			<div
				className={cn(
					"flex min-h-0 w-full min-w-0 flex-1 items-stretch",
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
					className={cn(
						doubtChat
							? "min-h-0 min-w-0 grow basis-0 overflow-hidden bg-background"
							: "min-h-0 min-w-0 grow basis-0 overflow-auto bg-background px-4 md:px-6 lg:px-8",
					)}
				>
					{children}
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
