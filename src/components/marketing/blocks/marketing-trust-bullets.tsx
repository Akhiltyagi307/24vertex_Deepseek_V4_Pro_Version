import { Check, X } from "lucide-react";

import {
	featureBentoCardSurfaceClassName,
	landingFeatureBentoShell,
} from "@/lib/marketing/landing-feature-surface";
import { cn } from "@/lib/utils";

type MarketingTrustBulletsProps = {
	items: string[];
	/** Check marks for capabilities; X marks for boundaries and exclusions. */
	tone?: "positive" | "negative";
	className?: string;
};

export function MarketingTrustBullets({
	items,
	tone = "positive",
	className,
}: MarketingTrustBulletsProps) {
	const Icon = tone === "positive" ? Check : X;
	const iconClassName =
		tone === "positive" ?
			"text-[var(--subject-grid-icon)]"
		:	"text-muted-foreground";

	return (
		<ul className={cn("grid gap-3 medium:grid-cols-1 medium:gap-3", className)}>
			{items.map((item) => (
				<li
					key={item}
					className={cn(
						"flex gap-3 px-4 py-3 text-sm leading-relaxed medium:px-5 medium:py-4 medium:text-base",
						tone === "positive" ? featureBentoCardSurfaceClassName : landingFeatureBentoShell,
					)}
				>
					<Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", iconClassName)} strokeWidth={2} />
					<span className="text-pretty text-foreground">{item}</span>
				</li>
			))}
		</ul>
	);
}
