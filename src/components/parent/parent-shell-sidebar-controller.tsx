"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isParentDoubtChatPath } from "@/lib/navigation/shell-immersive-paths";
import { cn } from "@/lib/utils";

type ParentShellSidebarControllerProps = {
	topBar: React.ReactNode;
	sidebar: React.ReactNode;
	children: React.ReactNode;
};

export function ParentShellSidebarController({ topBar, sidebar, children }: ParentShellSidebarControllerProps) {
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
							: "min-h-0 min-w-0 grow basis-0 overflow-auto bg-background px-4 md:px-6 lg:px-8",
					)}
				>
					{children}
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
