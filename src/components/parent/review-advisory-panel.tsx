import type { AdvisoryAction } from "@/lib/student/review-advisory";

function reasonLabel(action: AdvisoryAction): string {
	if (action.reason === "overdue") return "Overdue review";
	if (action.reason === "due_soon") {
		if (action.dueInDays != null && action.dueInDays <= 1) return "Due for review";
		return `Review in ${action.dueInDays} day${action.dueInDays === 1 ? "" : "s"}`;
	}
	return "Worth strengthening";
}

/**
 * Parent advisory: a ranked "what should my child do next" panel over the
 * child's review schedule. Presentational — the page loads + ranks the actions
 * (see loadAdvisoryActions) after verifying the parent↔child link.
 */
export function ParentReviewAdvisoryPanel({
	actions,
	childName,
}: {
	actions: AdvisoryAction[];
	childName: string;
}) {
	return (
		<section
			aria-label={`What ${childName} should focus on next`}
			className="rounded-xl border border-border bg-card p-4 medium:p-5"
		>
			<h2 className="text-sm font-semibold text-foreground">
				What {childName} should focus on next
			</h2>
			{actions.length === 0 ? (
				<p className="mt-2 text-sm text-muted-foreground">
					All caught up — nothing due for review right now.
				</p>
			) : (
				<ul className="mt-3 space-y-2">
					{actions.map((action) => (
						<li
							key={action.topicId}
							className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
						>
							<span className="min-w-0 truncate text-sm font-medium text-foreground">
								{action.topicName}
							</span>
							<span className="shrink-0 text-xs font-medium text-muted-foreground">
								{reasonLabel(action)}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
