"use client";

import Link from "next/link";
import { PresentationIcon } from "lucide-react";

import { StudentNavUser } from "@/components/student/student-nav-user";
import { TeacherNavMain } from "@/components/teacher/teacher-nav-main";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
	useSidebar,
} from "@/components/ui/sidebar";

export function TeacherAppSidebar({
	user,
	contextLabel,
}: {
	user: {
		name: string;
		email: string;
		avatar: string | null;
	};
	/** Shown under 24Vertex (e.g. organization type or “Teacher”). */
	contextLabel: string;
}) {
	const { state, isMobile } = useSidebar();
	const collapsedDesktop = state === "collapsed" && !isMobile;
	const homeTooltip = collapsedDesktop ? `24Vertex · ${contextLabel}` : undefined;
	const homeAriaLabel = collapsedDesktop ? `24Vertex, ${contextLabel}. Dashboard.` : undefined;

	return (
		<Sidebar collapsible="icon" className="!top-12 h-auto">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							tooltip={homeTooltip}
							aria-label={homeAriaLabel}
							render={<Link href="/teacher/dashboard" />}
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-violet-600 text-white dark:bg-violet-500">
								<PresentationIcon className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">24Vertex</span>
								<span className="truncate text-xs text-muted-foreground">{contextLabel}</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarSeparator />
			<SidebarContent>
				<TeacherNavMain />
			</SidebarContent>
			<SidebarFooter className="gap-2">
				<SidebarSeparator />
				<StudentNavUser user={user} settingsHref="/teacher/settings" />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
