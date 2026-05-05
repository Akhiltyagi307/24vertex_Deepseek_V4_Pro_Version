import { cn } from "@/lib/utils";

export function WizardStepIndicator({
	step,
	labels,
}: {
	step: number;
	labels: readonly string[];
}) {
	const total = labels.length;
	const currentLabel = labels[step] ?? "";

	return (
		<nav
			aria-label={`Practice setup. Step ${step + 1} of ${total}: ${currentLabel}`}
			className="w-full"
		>
			<div className="flex w-full gap-1.5 medium:gap-2" aria-hidden role="presentation">
				{labels.map((_, i) => {
					const isCurrent = i === step;
					const isDone = i < step;
					return (
						<div
							key={`practice-step-seg-${i}`}
							className={cn(
								"h-1.5 min-h-0 flex-1 rounded-full transition-colors medium:h-2",
								isDone && "bg-emerald-600 dark:bg-emerald-500",
								isCurrent &&
									"bg-emerald-600 ring-1 ring-emerald-500/45 ring-offset-1 ring-offset-background dark:bg-emerald-500",
								!isDone && !isCurrent && "bg-muted",
							)}
						/>
					);
				})}
			</div>
			<p className="text-muted-foreground mt-3 text-left text-sm tabular-nums">
				Step <span className="text-foreground font-medium">{step + 1}</span> of {total}
			</p>
		</nav>
	);
}
