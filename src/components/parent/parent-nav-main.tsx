"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	CreditCardIcon,
	FileBarChartIcon,
	LayoutDashboardIcon,
	UserRoundIcon,
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

const overviewItems: NavItem[] = [
	{ title: "Overview", href: "/parent/dashboard", icon: LayoutDashboardIcon },
	{
		title: "Learning chats",
		href: "/parent/doubt-chat",
		icon: MessageCircleIcon,
	},
];

const progressItems: NavItem[] = [
	{ title: "Subject progress", href: "/parent/performance", icon: TrendingUpIcon },
	{ title: "Test reports", href: "/parent/reports", icon: FileBarChartIcon },
];

const accountItems: NavItem[] = [
	{ title: "Account", href: "/parent/settings", icon: UserRoundIcon },
	{ title: "Plan & billing", href: "/parent/subscription", icon: CreditCardIcon },
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

export function ParentNavMain() {
	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel className={groupLabelClass}>Home</SidebarGroupLabel>
				<NavMenuItems items={overviewItems} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Progress</SidebarGroupLabel>
				<NavMenuItems items={progressItems} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Family account</SidebarGroupLabel>
				<NavMenuItems items={accountItems} />
			</SidebarGroup>
		</>
	);
}
