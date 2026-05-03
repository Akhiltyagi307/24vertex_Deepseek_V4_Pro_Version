"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { StudentAppSidebar } from "@/components/student/student-app-sidebar";
import { StudentTopBar } from "@/components/student/student-top-bar";
import { PaywallProvider } from "@/components/student/subscription/paywall-dialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import {
	isStudentDoubtChatPath,
	isStudentImmersiveShellPath,
	isStudentPracticeTestSessionPath,
} from "@/lib/navigation/shell-immersive-paths";
import { cn } from "@/lib/utils";

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
		() => !isStudentPracticeTestSessionPath(pathname),
	);

	React.useEffect(() => {
		if (isStudentPracticeTestSessionPath(pathname)) {
			setSidebarOpen(false);
		}
	}, [pathname]);

	const doubtChat = isStudentDoubtChatPath(pathname);
	const immersiveShell = isStudentImmersiveShellPath(pathname);

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
						"flex min-h-0 w-full min-w-0 flex-1 items-stretch",
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
						className={cn(
							doubtChat
								? "min-h-0 min-w-0 grow basis-0 overflow-hidden bg-background"
								: "min-h-0 min-w-0 grow basis-0 overflow-auto bg-background",
							!immersiveShell && "px-4 medium:px-6 xl:px-8",
						)}
					>
						{children}
					</SidebarInset>
				</div>
			</SidebarProvider>
		</PaywallProvider>
	);
}
