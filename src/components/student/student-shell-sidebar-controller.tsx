"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
	isStudentDoubtChatPath,
	isStudentImmersiveShellPath,
	isStudentPracticeTestSessionPath,
} from "@/lib/navigation/shell-immersive-paths";
import { cn } from "@/lib/utils";

type StudentShellSidebarControllerProps = {
	topBar: React.ReactNode;
	sidebar: React.ReactNode;
	children: React.ReactNode;
};

/**
 * Client island that owns sidebar open/closed state and pathname-driven layout
 * tweaks (immersive shell, doubt-chat overflow). The parent `StudentShell` stays
 * a server component; topBar / sidebar / children are passed as already-rendered
 * JSX props.
 */
export function StudentShellSidebarController({ topBar, sidebar, children }: StudentShellSidebarControllerProps) {
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
			{topBar}
			<div
				className={cn(
					"flex min-h-0 w-full min-w-0 flex-1 items-stretch",
					doubtChat && "overflow-hidden",
				)}
			>
				{sidebar}
				<SidebarInset
					className={cn(
						doubtChat
							? "min-h-0 min-w-0 grow basis-0 overflow-hidden bg-background"
							: "min-h-0 min-w-0 grow basis-0 overflow-auto bg-background",
						!immersiveShell && "px-4 md:px-6 lg:px-8",
					)}
				>
					{children}
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
