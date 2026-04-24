"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	CreditCardIcon,
	FileBarChartIcon,
	LayoutDashboardIcon,
	UserRoundIcon,
	SquarePenIcon,
	TrendingUpIcon,
	MessageCircleIcon,
} from "lucide-react";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";

type NavItem = {
	title: string;
	href: string;
	icon: ComponentType<{ className?: string }>;
};

const primaryItems: NavItem[] = [
	{ title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboardIcon },
	{ title: "Practice", href: "/student/practice", icon: SquarePenIcon },
	{ title: "Ask a topic", href: "/student/doubt-chat", icon: MessageCircleIcon },
];

const progressItems: NavItem[] = [
	{ title: "Performance", href: "/student/performance", icon: TrendingUpIcon },
	{ title: "Reports", href: "/student/reports", icon: FileBarChartIcon },
];

const accountItems: NavItem[] = [
	{ title: "Profile", href: "/student/settings", icon: UserRoundIcon },
	{ title: "Subscription", href: "/student/subscription", icon: CreditCardIcon },
];

const groupLabelClass =
	"font-mono text-2xs uppercase tracking-wider text-muted-foreground";

function NavMenuItems({ items }: { items: NavItem[] }) {
	const pathname = usePathname();

	return (
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
							render={<Link href={item.href} />}
						>
							<Icon />
							<span>{item.title}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				);
			})}
		</SidebarMenu>
	);
}

export function StudentNavMain() {
	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel className={groupLabelClass}>Student</SidebarGroupLabel>
				<NavMenuItems items={primaryItems} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<NavMenuItems items={progressItems} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<NavMenuItems items={accountItems} />
			</SidebarGroup>
		</>
	);
}
