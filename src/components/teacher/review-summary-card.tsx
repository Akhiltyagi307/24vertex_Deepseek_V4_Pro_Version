import type { TeacherReviewSummary } from "@/lib/teachers/teacher-review-summary";

/**
 * Read-only class summary of auto-retests. Renders nothing until the
 * spaced-repetition loop has issued reviews, so it stays invisible while the
 * loop is dormant and surfaces only when there's something to show.
 */
export function TeacherReviewSummaryCard({ summary }: { summary: TeacherReviewSummary }) {
	if (summary.issued === 0) return null;

	const cells: Array<{ label: string; value: number; tone?: "overdue" }> = [
		{ label: "Issued", value: summary.issued },
		{ label: "Completed", value: summary.completed },
		{ label: "Overdue", value: summary.overdue, tone: "overdue" },
	];

	return (
		<section
			aria-label="Auto-retests for your class"
			className="rounded-xl border border-border bg-card p-4 medium:p-5"
		>
			<h2 className="text-sm font-semibold text-foreground">Auto-retests (this class)</h2>
			<p className="mt-1 text-xs text-muted-foreground">
				Spaced-repetition reviews the system issued to strengthen weak topics. Read-only.
			</p>
			<dl className="mt-3 grid grid-cols-3 gap-3">
				{cells.map((cell) => (
					<div
						key={cell.label}
						className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
					>
						<dt className="text-xs text-muted-foreground">{cell.label}</dt>
						<dd
							className={
								cell.tone === "overdue" && cell.value > 0
									? "text-lg font-semibold tabular-nums text-destructive"
									: "text-lg font-semibold tabular-nums text-foreground"
							}
						>
							{cell.value}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
