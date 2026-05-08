"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type DashboardShellProps = {
	/** Pre-rendered top bar slot (caller wires role-specific props). */
	topBar: React.ReactNode;
	/** Pre-rendered sidebar slot (caller wires role-specific props). */
	sidebar: React.ReactNode;
	/**
	 * Pathname predicate that, when true, switches the shell to fixed-viewport
	 * doubt-chat layout (`h-dvh max-h-dvh overflow-hidden`).
	 */
	isDoubtChatPath: (pathname: string) => boolean;
	/**
	 * Pathname predicate that, when true, sets sidebar `open=false` on mount and
	 * forces it closed on path change. Student closes during practice-test
	 * sessions; parent closes during doubt chat.
	 */
	isSidebarHiddenPath: (pathname: string) => boolean;
	/**
	 * Pathname predicate that, when true, drops the inset's horizontal padding
	 * so a route can render full-bleed (e.g. doubt chat, practice session).
	 * Defaults to always-false (always padded).
	 */
	isImmersiveShellPath?: (pathname: string) => boolean;
	children: React.ReactNode;
};

const alwaysFalse = () => false;

export function DashboardShell({
	topBar,
	sidebar,
	isDoubtChatPath,
	isSidebarHiddenPath,
	isImmersiveShellPath = alwaysFalse,
	children,
}: DashboardShellProps) {
	const pathname = usePathname();
	const [sidebarOpen, setSidebarOpen] = React.useState(() => !isSidebarHiddenPath(pathname));

	React.useEffect(() => {
		if (isSidebarHiddenPath(pathname)) {
			setSidebarOpen(false);
		}
	}, [pathname, isSidebarHiddenPath]);

	const doubtChat = isDoubtChatPath(pathname);
	const immersive = isImmersiveShellPath(pathname);

	return (
		<SidebarProvider
			className={cn(
				"flex w-full flex-col",
				doubtChat ? "h-dvh max-h-dvh min-h-0 overflow-hidden" : "min-h-svh",
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
						!immersive && "px-4 medium:px-6 xl:px-8",
					)}
				>
					<main
						id="main-content"
						tabIndex={-1}
						className={cn(
							"min-w-0 outline-none",
							/* Doubt chat + other immersive routes need a flex column that fills the pane
							 * so `h-full` children (composer, session chrome) pin correctly. */
							(doubtChat || immersive) && "flex min-h-0 flex-1 flex-col",
						)}
					>
						{children}
					</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
