"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type PracticeProgressBucket = {
	id: string;
	label: string;
};

export type PracticeProgressChecklistProps = {
	buckets: readonly PracticeProgressBucket[];
	/** Highest completed bucket (1-based); 0 = nothing done yet. */
	doneThrough: number;
	/** 1-based bucket index that may show an extra detail line (e.g. drafted count). */
	progressBucketIndex?: number;
	progressDetail?: string | null;
	ariaLabel: string;
	className?: string;
};

export function PracticeProgressChecklist({
	buckets,
	doneThrough,
	progressBucketIndex,
	progressDetail,
	ariaLabel,
	className,
}: PracticeProgressChecklistProps) {
	return (
		<ol className={cn("w-full max-w-xs space-y-2.5", className)} aria-label={ariaLabel}>
			{buckets.map((bucket, i) => {
				const index = i + 1;
				const status =
					index <= doneThrough ? "done"
					: index === doneThrough + 1 ? "active"
					: "pending";
				const showDetail =
					status === "active" &&
					progressBucketIndex === index &&
					progressDetail != null &&
					progressDetail.length > 0;
				return (
					<li key={bucket.id} className="flex items-start gap-2.5">
						<span
							className={cn(
								"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
								status === "done" ?
									"border-emerald-600/40 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
								: status === "active" ?
									"border-primary/50 bg-primary/10 text-primary"
								:	"border-border bg-muted/40",
							)}
							aria-hidden
						>
							{status === "done" ?
								<CheckIcon className="size-3" strokeWidth={2.5} />
							: status === "active" ?
								<span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
							:	<span className="size-1.5 rounded-full bg-muted-foreground/40" />}
						</span>
						<span className="flex flex-col gap-0.5">
							<span
								className={cn(
									"text-sm leading-snug",
									status === "pending" ? "text-muted-foreground/60" : "text-foreground",
								)}
							>
								{bucket.label}
							</span>
							{showDetail ? (
								<span className="text-muted-foreground text-xs tabular-nums">{progressDetail}</span>
							) : null}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
