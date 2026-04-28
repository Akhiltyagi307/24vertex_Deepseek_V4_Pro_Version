"use client";

import Link from "next/link";
import { GraduationCapIcon } from "lucide-react";

import { ParentNavMain } from "@/components/parent/parent-nav-main";
import { StudentNavUser } from "@/components/student/student-nav-user";
import {
	SidebarPlanCard,
	statusTone,
} from "@/components/student/subscription/sidebar-plan-card";
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
} from "@/components/ui/sidebar";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

export function ParentAppSidebar({
	user,
	childGradeLabel,
	entitlement,
}: {
	user: {
		name: string;
		email: string;
		avatar: string | null;
	};
	/** Shown under EduAI (child's grade / section). */
	childGradeLabel: string;
	entitlement: EntitlementSnapshot | null;
}) {
	const collapsedTone = entitlement ? statusTone(entitlement) : null;
	const showCollapsedDot =
		collapsedTone === "warn" || collapsedTone === "danger";

	return (
		<Sidebar collapsible="icon" className="!top-12 h-auto">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" render={<Link href="/parent/dashboard" />}>
							<div className="relative flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600 text-white dark:bg-emerald-500">
								<GraduationCapIcon className="size-4" />
								{showCollapsedDot && (
									<span
										aria-hidden
										className={cn(
											"absolute -top-1 -right-1 size-2.5 rounded-full ring-1 ring-sidebar",
											"hidden group-data-[collapsible=icon]:block",
											collapsedTone === "danger"
												? "bg-rose-500"
												: "bg-amber-500",
										)}
									/>
								)}
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">EduAI</span>
								<span className="truncate text-xs text-muted-foreground">{childGradeLabel}</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarSeparator />
			<SidebarContent>
				<ParentNavMain />
			</SidebarContent>
			<SidebarFooter className="gap-2">
				{entitlement ? (
					<SidebarPlanCard
						entitlement={entitlement}
						manageHref="/parent/subscription"
					/>
				) : null}
				<SidebarSeparator />
				<StudentNavUser user={user} settingsHref="/parent/settings" />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
