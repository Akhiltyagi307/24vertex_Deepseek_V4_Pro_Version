"use client";

import {
	AppHeaderBrandTrail,
	HeaderBreadcrumbSlash,
} from "@/components/layout/app-header-brand-trail";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const topBarControlChrome =
	"border border-border/90 bg-sidebar-accent shadow-sm dark:border-border dark:bg-sidebar-accent";

export type TeacherTopBarProps = {
	organizationName: string;
	userDisplayName: string;
};

export function TeacherTopBar({ organizationName, userDisplayName }: TeacherTopBarProps) {
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
					shareableId={null}
					headerPortal="student"
					omitLogo={false}
				/>
			</div>
			<div className="flex items-center gap-2">
				<ThemeToggle />
			</div>
		</header>
	);
}
