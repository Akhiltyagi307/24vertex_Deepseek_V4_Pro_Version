import { cn } from "@/lib/utils";

type Props = {
	amountPaise: number;
	period: "month" | "year";
	/** If set and > amountPaise, renders a strikethrough compare-at price plus savings pill. */
	compareAtPaise?: number;
	className?: string;
};

function formatRupeeAmount(paise: number): string {
	const rupees = Math.round(paise / 100);
	return rupees.toLocaleString("en-IN");
}

export function PriceDisplay({ amountPaise, period, compareAtPaise, className }: Props) {
	const showCompare = typeof compareAtPaise === "number" && compareAtPaise > amountPaise;
	const savingsPaise = showCompare ? compareAtPaise - amountPaise : 0;
	const savingsPercent = showCompare
		? Math.round((savingsPaise / (compareAtPaise as number)) * 100)
		: 0;

	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<div className="flex items-baseline gap-2">
				<span className="font-heading text-3xl font-semibold tracking-tight tabular-nums text-foreground medium:text-4xl">
					{`\u20B9\u00A0${formatRupeeAmount(amountPaise)}`}
				</span>
				<span className="text-sm text-muted-foreground">
					<span className="sr-only">per </span>
					/ {period}
				</span>
			</div>
			{showCompare ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm text-muted-foreground line-through tabular-nums">
						{`\u20B9\u00A0${formatRupeeAmount(compareAtPaise as number)}`}
					</span>
					<span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
						{`Save \u20B9\u00A0${formatRupeeAmount(savingsPaise)} \u00B7 ${savingsPercent}%`}
					</span>
				</div>
			) : null}
		</div>
	);
}
