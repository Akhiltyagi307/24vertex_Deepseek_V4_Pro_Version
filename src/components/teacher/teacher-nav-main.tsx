"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
};

const primaryItems: NavItem[] = [
	{ title: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboardIcon },
	{ title: "Link Student", href: "/teacher/students", icon: UsersRoundIcon },
	{ title: "Assignments", href: "/teacher/assignments", icon: ClipboardListIcon },
	{ title: "Student performance", href: "/teacher/student-performance", icon: LineChartIcon },
	{ title: "Topic performance", href: "/teacher/topic-performance", icon: ListTree },
	{ title: "Settings", href: "/teacher/settings", icon: SettingsIcon },
];

const groupLabelClass =
	"font-mono text-2xs uppercase tracking-wider text-muted-foreground";

export function TeacherNavMain() {
	const pathname = usePathname();

	return (
		<SidebarGroup>
			<SidebarGroupLabel className={groupLabelClass}>Teacher</SidebarGroupLabel>
			<SidebarMenu>
				{primaryItems.map((item) => {
					const Icon = item.icon;
					const isActive =
						pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<SidebarMenuItem key={item.href}>
							<SidebarMenuButton
								isActive={isActive}
								tooltip={item.title}
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
