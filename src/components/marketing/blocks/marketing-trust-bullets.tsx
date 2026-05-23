import { Check } from "lucide-react";

import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { cn } from "@/lib/utils";

type MarketingTrustBulletsProps = {
	items: string[];
	className?: string;
};

export function MarketingTrustBullets({ items, className }: MarketingTrustBulletsProps) {
	return (
		<ul className={cn("grid gap-3 medium:grid-cols-2 medium:gap-4", className)}>
			{items.map((item) => (
				<li
					key={item}
					className={cn(
						"flex gap-3 px-4 py-3 text-sm leading-relaxed text-muted-foreground medium:px-5 medium:py-4 medium:text-base",
						featureBentoCardSurfaceClassName,
					)}
				>
					<Check
						aria-hidden
						className="text-[var(--subject-grid-icon)] mt-0.5 size-5 shrink-0"
						strokeWidth={2}
					/>
					<span className="text-pretty text-foreground">{item}</span>
				</li>
			))}
		</ul>
	);
}
