import type { ReactNode } from "react";

import { ParentPortalSignOut } from "@/components/parent/parent-portal-sign-out";
import { cn } from "@/lib/utils";

type ParentPortalStandaloneShellProps = {
	children: ReactNode;
};

/** Same width cap as auth split shell so standalone parent flows feel like sign-in cards. */
const standaloneColumn = "mx-auto w-full min-w-0 medium:max-w-[50dvw]";

/** Shared layout for parent flows outside the dashboard shell (picker, link child). */
export function ParentPortalStandaloneShell({ children }: ParentPortalStandaloneShellProps) {
	return (
		<div className="relative min-h-svh overflow-x-hidden bg-background px-4 py-8 medium:px-6 medium:py-12">
			<div
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-12%,rgba(46,160,112,0.14),transparent_58%)] dark:bg-[radial-gradient(ellipse_90%_55%_at_50%_-12%,rgba(46,160,112,0.18),transparent_58%)]"
				aria-hidden
			/>
			<div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-none flex-col medium:min-h-[calc(100svh-6rem)]">
				<div className="flex flex-1 flex-col justify-center">
					<div className={cn(standaloneColumn, "flex flex-col gap-6")}>
						<div className="flex shrink-0 items-start justify-between gap-4">
							<div className="min-w-0 pt-0.5">
								<p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
									Parent portal
								</p>
							</div>
							<ParentPortalSignOut />
						</div>
						<div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/20 medium:p-8">
							{children}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
