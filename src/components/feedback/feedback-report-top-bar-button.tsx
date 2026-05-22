"use client";

import { LifeBuoy } from "lucide-react";
import * as React from "react";

import { FeedbackReportDialog } from "@/components/feedback/feedback-report-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FeedbackCategory, FeedbackPortal } from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

const topBarControlChrome =
	"border border-border/90 bg-sidebar-accent shadow-sm dark:border-border dark:bg-sidebar-accent";

export type FeedbackReportTopBarButtonProps = {
	portal: FeedbackPortal;
	defaultCategory?: FeedbackCategory;
	errorDigest?: string;
	sentryEventId?: string;
};

export function FeedbackReportTopBarButton({
	portal,
	defaultCategory,
	errorDigest,
	sentryEventId,
}: FeedbackReportTopBarButtonProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className={cn(
								"size-8 shrink-0 rounded-md text-foreground hover:bg-foreground/10 dark:hover:bg-foreground/15",
								topBarControlChrome,
							)}
							aria-label="Report a problem or send feedback"
							onClick={() => setOpen(true)}
						>
							<LifeBuoy className="size-4" aria-hidden />
						</Button>
					}
				/>
				<TooltipContent>Help &amp; feedback</TooltipContent>
			</Tooltip>
			<FeedbackReportDialog
				open={open}
				onOpenChange={setOpen}
				portal={portal}
				defaultCategory={defaultCategory}
				errorDigest={errorDigest}
				sentryEventId={sentryEventId}
			/>
		</>
	);
}
