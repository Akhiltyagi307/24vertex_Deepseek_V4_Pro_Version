import type { ReactNode } from "react";

import { ParentPortalSignOut } from "@/components/parent/parent-portal-sign-out";

type ParentPortalStandaloneShellProps = {
	children: ReactNode;
};

/** Shared layout for parent flows outside the dashboard shell (picker, link child). */
export function ParentPortalStandaloneShell({ children }: ParentPortalStandaloneShellProps) {
	return (
		<div className="relative min-h-svh overflow-hidden bg-background px-4 py-8 sm:px-6 sm:py-12">
			<div
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-12%,rgba(46,160,112,0.14),transparent_58%)] dark:bg-[radial-gradient(ellipse_90%_55%_at_50%_-12%,rgba(46,160,112,0.18),transparent_58%)]"
				aria-hidden
			/>
			<div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-md flex-col sm:min-h-[calc(100svh-6rem)]">
				<div className="flex shrink-0 items-start justify-between gap-4 pb-8">
					<div className="min-w-0 pt-0.5">
						<p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
							Parent portal
						</p>
					</div>
					<ParentPortalSignOut />
				</div>
				{children}
			</div>
		</div>
	);
}
