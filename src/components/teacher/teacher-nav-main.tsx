"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	ClipboardCheckIcon,
	ClipboardListIcon,
	LayoutDashboardIcon,
	LineChartIcon,
	ListTree,
	SettingsIcon,
	UsersRoundIcon,
} from "lucide-react";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
	title: string;
	href: string;
	icon: ComponentType<{ className?: string }>;
	/** Stable hook for the first-run coach-marks tour (see teacher-onboarding.tsx). */
	onboardingId: string;
	/** Code-based student linking is only for teachers outside an organization; org rosters live under Student performance. */
	independentOnly?: boolean;
};

const primaryItems: NavItem[] = [
	{ title: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboardIcon, onboardingId: "nav-teacher-dashboard" },
	{ title: "Link Student", href: "/teacher/students", icon: UsersRoundIcon, onboardingId: "nav-link-student", independentOnly: true },
	{ title: "Assignments", href: "/teacher/assignments", icon: ClipboardListIcon, onboardingId: "nav-assignments" },
	{ title: "Submissions", href: "/teacher/submissions", icon: ClipboardCheckIcon, onboardingId: "nav-submissions" },
	{ title: "Student performance", href: "/teacher/student-performance", icon: LineChartIcon, onboardingId: "nav-student-performance" },
	{ title: "Topic performance", href: "/teacher/topic-performance", icon: ListTree, onboardingId: "nav-topic-performance" },
	{ title: "Settings", href: "/teacher/settings", icon: SettingsIcon, onboardingId: "nav-settings" },
];

const groupLabelClass =
	"font-mono text-2xs uppercase tracking-wider text-muted-foreground";

export function TeacherNavMain({ hasOrganization }: { hasOrganization: boolean }) {
	const pathname = usePathname();
	const items = hasOrganization ? primaryItems.filter((item) => !item.independentOnly) : primaryItems;

	return (
		<SidebarGroup>
			<SidebarGroupLabel className={groupLabelClass}>Teacher</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					const Icon = item.icon;
					const isActive =
						pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<SidebarMenuItem key={item.href}>
							<SidebarMenuButton
								isActive={isActive}
								tooltip={item.title}
								data-onboarding-id={item.onboardingId}
								render={<Link href={item.href} />}
							>
								<Icon />
								<span>{item.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
