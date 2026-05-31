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
	TrendingUpIcon,
	MessageCircleIcon,
	BookOpenIcon,
} from "lucide-react";

import { SidebarAttentionDot } from "@/components/student/notifications/notification-unread-pill";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { useOpenAssignmentsIndicator } from "@/lib/assignments/use-open-assignments-indicator";

type NavItem = {
	title: string;
	href: string;
	icon: ComponentType<{ className?: string }>;
	/** Coach-mark target id; matched by the parent onboarding tour. */
	onboardingId?: string;
};

const overviewItems: NavItem[] = [
	{
		title: "Overview",
		href: "/parent/dashboard",
		icon: LayoutDashboardIcon,
		onboardingId: "nav-parent-overview",
	},
	{
		title: "Learning chats",
		href: "/parent/doubt-chat",
		icon: MessageCircleIcon,
		onboardingId: "nav-learning-chats",
	},
];

const progressItems: NavItem[] = [
	{
		title: "Assignments",
		href: "/parent/assignments",
		icon: ClipboardListIcon,
		onboardingId: "nav-assignments",
	},
	{
		title: "Subject progress",
		href: "/parent/performance",
		icon: TrendingUpIcon,
		onboardingId: "nav-subject-progress",
	},
	{
		title: "Test reports",
		href: "/parent/reports",
		icon: FileBarChartIcon,
		onboardingId: "nav-test-reports",
	},
	{ title: "QnA logs", href: "/parent/qna-logs", icon: BookOpenIcon },
];

const accountItems: NavItem[] = [
	{ title: "Notifications", href: "/parent/notifications", icon: BellIcon },
	{ title: "Account", href: "/parent/settings", icon: UserRoundIcon },
	{ title: "Plan & billing", href: "/parent/subscription", icon: CreditCardIcon },
];

const groupLabelClass =
	"font-mono text-2xs uppercase tracking-wider text-muted-foreground";

const PARENT_ASSIGNMENTS_HREF = "/parent/assignments";

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
		apiBasePath: "/api/parent/assignments",
		initialHasOpen,
		skipMountRefresh: true,
		routeKey: pathname,
	});
	const isActive =
		pathname === item.href || pathname.startsWith(`${item.href}/`);
	const ariaLabel =
		hasOpen ? `${item.title}, child has open assignments` : item.title;

	return (
		<SidebarMenuItem key={item.href} data-onboarding-id={item.onboardingId}>
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

function NavMenuItems({
	items,
	initialHasOpenAssignments = false,
}: {
	items: NavItem[];
	initialHasOpenAssignments?: boolean;
}) {
	const pathname = usePathname();

	return (
		<SidebarMenu>
			{items.map((item) => {
				const Icon = item.icon;
				const isActive =
					pathname === item.href || pathname.startsWith(`${item.href}/`);
				if (item.href === PARENT_ASSIGNMENTS_HREF) {
					return (
						<SidebarAssignmentsRow
							key={item.href}
							item={item}
							pathname={pathname}
							initialHasOpen={initialHasOpenAssignments}
						/>
					);
				}
				return (
					<SidebarMenuItem key={item.href} data-onboarding-id={item.onboardingId}>
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

export function ParentNavMain({
	initialHasOpenAssignments = false,
}: {
	initialHasOpenAssignments?: boolean;
}) {
	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel className={groupLabelClass}>Home</SidebarGroupLabel>
				<NavMenuItems items={overviewItems} />
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Progress</SidebarGroupLabel>
				<NavMenuItems
					items={progressItems}
					initialHasOpenAssignments={initialHasOpenAssignments}
				/>
			</SidebarGroup>
			<SidebarSeparator />
			<SidebarGroup className="pt-0">
				<SidebarGroupLabel className={groupLabelClass}>Family account</SidebarGroupLabel>
				<NavMenuItems items={accountItems} />
			</SidebarGroup>
		</>
	);
}
