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

import {
	NotificationUnreadPill,
	SidebarAttentionDot,
} from "@/components/student/notifications/notification-unread-pill";
import { useOpenAssignmentsIndicator } from "@/lib/assignments/use-open-assignments-indicator";
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
const STUDENT_ASSIGNMENTS_HREF = "/student/assignments";

function SidebarAssignmentsRow({
	item,
	pathname,
	initialHasOpen,
}: {
	item: NavItem;
	pathname: string;
	initialHasOpen: boolean;
}) {
	const Icon = item.icon;
	const { hasOpen } = useOpenAssignmentsIndicator({
		apiBasePath: "/api/student/assignments",
		initialHasOpen,
		skipMountRefresh: true,
		routeKey: pathname,
	});
	const isActive =
		pathname === item.href || pathname.startsWith(`${item.href}/`);
	const ariaLabel = hasOpen ? `${item.title}, open assignments` : item.title;

	return (
		<SidebarMenuItem key={item.href}>
			<SidebarMenuButton
				isActive={isActive}
				tooltip={item.title}
				render={<Link href={item.href} aria-label={ariaLabel} />}
			>
				<span className="relative inline-flex shrink-0">
					<Icon />
					<SidebarAttentionDot show={hasOpen} />
				</span>
				<span>{item.title}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

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
	initialHasOpenAssignments = false,
}: {
	items: NavItem[];
	/** When set, the Notifications row shows the same unread pill as the top bar. */
	userId?: string | null;
	initialHasOpenAssignments?: boolean;
}) {
	const pathname = usePathname();

	return (
		<SidebarMenu>
			{items.map((item) => {
				const Icon = item.icon;
				const isActive =
					pathname === item.href || pathname.startsWith(`${item.href}/`);
				if (item.href === STUDENT_ASSIGNMENTS_HREF) {
					return (
						<SidebarAssignmentsRow
							key={item.href}
							item={item}
							pathname={pathname}
							initialHasOpen={initialHasOpenAssignments}
						/>
					);
				}
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

export function StudentNavMain({
	userId,
	initialHasOpenAssignments = false,
}: {
	userId?: string | null;
	initialHasOpenAssignments?: boolean;
}) {
	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel className={groupLabelClass}>Student</SidebarGroupLabel>
				<NavMenuItems items={primaryItems} userId={userId} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Progress</SidebarGroupLabel>
				<NavMenuItems
					items={progressItems}
					userId={userId}
					initialHasOpenAssignments={initialHasOpenAssignments}
				/>
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Account</SidebarGroupLabel>
				<NavMenuItems items={accountItems} userId={userId} />
			</SidebarGroup>
		</>
	);
}
