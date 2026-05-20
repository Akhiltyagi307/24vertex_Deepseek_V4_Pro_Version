"use client";

import {
	AppHeaderBrandTrail,
	HeaderBreadcrumbSlash,
	type HeaderPortal,
} from "@/components/layout/app-header-brand-trail";
import { ActivityStreakWidget } from "@/components/student/activity-streak-widget";
import { StudentNotificationsBell } from "@/components/student/notifications/notifications-bell";
import type { StudentActivityStreakSnapshot } from "@/lib/student/activity-streak";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/** Match theme / logout controls in `ThemeToggle` */
const topBarControlChrome =
	"border border-border/90 bg-sidebar-accent shadow-sm dark:border-border dark:bg-sidebar-accent";

export type StudentTopBarProps = {
	organizationName: string;
	userDisplayName: string;
	shareableId?: string | null;
	/** Parent portal uses child link wording for the ID copy control. */
	headerPortal?: HeaderPortal;
	/** Present for the student portal (bell + unread). */
	userId?: string | null;
	/** Server-hydrated weekly streak for the top-bar widget. */
	activityStreak?: StudentActivityStreakSnapshot | null;
	/** Parent auth user id — when set with `headerPortal="parent"`, shows parent notifications bell. */
	parentNotificationsUserId?: string | null;
};

export function StudentTopBar({
	organizationName,
	userDisplayName,
	shareableId,
	headerPortal = "student",
	userId,
	parentNotificationsUserId,
	activityStreak = null,
}: StudentTopBarProps) {
	return (
		<header className="sticky top-[env(safe-area-inset-top)] z-50 flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-sidebar px-4">
			<div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm medium:gap-x-3">
				<SidebarTrigger
					className={cn(
						"-ml-1 size-8 shrink-0 rounded-md text-foreground hover:bg-foreground/10 dark:hover:bg-foreground/15",
						topBarControlChrome,
					)}
				/>
				<HeaderBreadcrumbSlash />
				<AppHeaderBrandTrail
					organizationName={organizationName}
					userDisplayName={userDisplayName}
					shareableId={shareableId}
					headerPortal={headerPortal}
					omitLogo={false}
				/>
			</div>
			<div className="flex items-center gap-2">
				{userId && headerPortal === "student" ? (
					<ActivityStreakWidget initialSnapshot={activityStreak} />
				) : null}
				{userId && headerPortal === "student" ? (
					<StudentNotificationsBell userId={userId} />
				) : parentNotificationsUserId && headerPortal === "parent" ? (
					<StudentNotificationsBell
						userId={parentNotificationsUserId}
						apiBasePath="/api/parent/notifications"
						notificationsPageHref="/parent/notifications"
						portal="parent"
					/>
				) : null}
				<ThemeToggle />
			</div>
		</header>
	);
}
