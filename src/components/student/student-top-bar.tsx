"use client";

import {
	AppHeaderBrandTrail,
	HeaderBreadcrumbSlash,
	type HeaderPortal,
} from "@/components/layout/app-header-brand-trail";
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
};

export function StudentTopBar({
	organizationName,
	userDisplayName,
	shareableId,
	headerPortal = "student",
}: StudentTopBarProps) {
	return (
		<header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-sidebar px-4">
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
			<ThemeToggle />
		</header>
	);
}
