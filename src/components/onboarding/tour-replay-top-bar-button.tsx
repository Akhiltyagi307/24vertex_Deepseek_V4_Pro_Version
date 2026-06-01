"use client";

import { CompassIcon } from "lucide-react";

import { requestTourReplay, type TourScope } from "@/components/onboarding/tour-replay";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Match the theme / feedback controls in the top bar. */
const topBarControlChrome =
	"border border-border/90 bg-sidebar-accent shadow-sm dark:border-border dark:bg-sidebar-accent";

export type TourReplayTopBarButtonProps = {
	scope: TourScope;
};

/**
 * Top-bar control that (re)starts the role's onboarding tour — the re-entry point
 * after the first-run welcome is gone. Hidden below the `medium` breakpoint, where
 * the sidebar is a closed drawer and the tour has no nav items to anchor to.
 */
export function TourReplayTopBarButton({ scope }: TourReplayTopBarButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"hidden size-8 shrink-0 rounded-md text-foreground hover:bg-foreground/10 medium:inline-flex dark:hover:bg-foreground/15",
							topBarControlChrome,
						)}
						aria-label="Take the product tour"
						onClick={() => requestTourReplay(scope)}
					>
						<CompassIcon className="size-4" aria-hidden />
					</Button>
				}
			/>
			<TooltipContent>Take the tour</TooltipContent>
		</Tooltip>
	);
}
