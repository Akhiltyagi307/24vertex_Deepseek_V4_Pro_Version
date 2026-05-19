"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	BellIcon,
	ClipboardListIcon,
	CreditCardIcon,
	FileBarChartIcon,
	LayoutDashboardIcon,
	UserRoundIcon,
	SquarePenIcon,
	TrendingUpIcon,
	MessageCircleIcon,
	BookOpenIcon,
} from "lucide-react";

import { NotificationUnreadPill } from "@/components/student/notifications/notification-unread-pill";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { useNotificationUnreadCount } from "@/lib/notifications/use-notification-unread-count";

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
	{ title: "Assignments", href: "/student/assignments", icon: ClipboardListIcon },
	{ title: "Performance", href: "/student/performance", icon: TrendingUpIcon },
	{ title: "Reports", href: "/student/reports", icon: FileBarChartIcon },
	{ title: "QnA logs", href: "/student/qna-logs", icon: BookOpenIcon },
];

const accountItems: NavItem[] = [
	{ title: "Notifications", href: "/student/notifications", icon: BellIcon },
	{ title: "Profile", href: "/student/settings", icon: UserRoundIcon },
	{ title: "Plan & billing", href: "/student/subscription", icon: CreditCardIcon },
];

const groupLabelClass =
	"font-mono text-2xs uppercase tracking-wider text-muted-foreground";

const STUDENT_NOTIFICATIONS_HREF = "/student/notifications";

function SidebarNotificationsRow({
	userId,
	item,
	pathname,
}: {
	userId: string;
	item: NavItem;
	pathname: string;
}) {
	const Icon = item.icon;
	const { count } = useNotificationUnreadCount({
		userId,
		apiBasePath: "/api/student/notifications",
		realtimeScope: "nav",
	});
	const isActive =
		pathname === item.href || pathname.startsWith(`${item.href}/`);
	const ariaLabel =
		count === 0
			? item.title
			: count === 1
				? `${item.title}, 1 unread`
				: `${item.title}, ${count} unread`;

	return (
		<SidebarMenuItem key={item.href}>
			<SidebarMenuButton
				isActive={isActive}
				tooltip={item.title}
				render={<Link href={item.href} aria-label={ariaLabel} />}
			>
				<span className="relative inline-flex shrink-0">
					<Icon />
					<NotificationUnreadPill count={count} />
				</span>
				<span>{item.title}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function NavMenuItems({
	items,
	userId,
}: {
	items: NavItem[];
	/** When set, the Notifications row shows the same unread pill as the top bar. */
	userId?: string | null;
}) {
	const pathname = usePathname();

	return (
		<SidebarMenu>
			{items.map((item) => {
				const Icon = item.icon;
				const isActive =
					pathname === item.href || pathname.startsWith(`${item.href}/`);
				if (userId && item.href === STUDENT_NOTIFICATIONS_HREF) {
					return (
						<SidebarNotificationsRow
							key={item.href}
							userId={userId}
							item={item}
							pathname={pathname}
						/>
					);
				}
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

export function StudentNavMain({ userId }: { userId?: string | null }) {
	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel className={groupLabelClass}>Student</SidebarGroupLabel>
				<NavMenuItems items={primaryItems} userId={userId} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Progress</SidebarGroupLabel>
				<NavMenuItems items={progressItems} userId={userId} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Account</SidebarGroupLabel>
				<NavMenuItems items={accountItems} userId={userId} />
			</SidebarGroup>
		</>
	);
}
