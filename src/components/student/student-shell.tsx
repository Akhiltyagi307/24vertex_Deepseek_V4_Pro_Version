"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { StudentAppSidebar } from "@/components/student/student-app-sidebar";
import { StudentTopBar } from "@/components/student/student-top-bar";
import { PaywallProvider } from "@/components/student/subscription/paywall-dialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

/** In-progress practice test at `/student/practice/[testId]` (not the practice hub). */
function isPracticeTestSessionPath(pathname: string): boolean {
	const segments = pathname.split("/").filter(Boolean);
	return (
		segments.length === 3 && segments[0] === "student" && segments[1] === "practice"
	);
}

/** Doubt chat uses full viewport height; only the message pane scrolls. */
function isDoubtChatPath(pathname: string): boolean {
	return pathname === "/student/doubt-chat";
}

export type StudentShellProps = {
	organizationName: string;
	userDisplayName: string;
	shareableId?: string | null;
	email: string;
	avatarUrl: string | null;
	gradeLabel: string;
	entitlement: EntitlementSnapshot | null;
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
	children,
}: StudentShellProps) {
	const pathname = usePathname();
	const [sidebarOpen, setSidebarOpen] = React.useState(
		() => !isPracticeTestSessionPath(pathname),
	);

	React.useEffect(() => {
		if (isPracticeTestSessionPath(pathname)) {
			setSidebarOpen(false);
		}
	}, [pathname]);

	const doubtChat = isDoubtChatPath(pathname);

	return (
		<PaywallProvider>
			<SidebarProvider
				className={cn(
					"flex w-full flex-col",
					doubtChat
						? "h-dvh max-h-dvh min-h-0 overflow-hidden"
						: "min-h-svh",
				)}
				open={sidebarOpen}
				onOpenChange={setSidebarOpen}
			>
				<StudentTopBar
					organizationName={organizationName}
					userDisplayName={userDisplayName}
					shareableId={shareableId}
				/>
				<div
					className={cn(
						"flex min-h-0 w-full min-w-0 flex-1",
						doubtChat && "overflow-hidden",
					)}
				>
					<StudentAppSidebar
						user={{
							name: userDisplayName,
							email,
							avatar: avatarUrl,
						}}
						gradeLabel={gradeLabel}
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
		</PaywallProvider>
	);
}
