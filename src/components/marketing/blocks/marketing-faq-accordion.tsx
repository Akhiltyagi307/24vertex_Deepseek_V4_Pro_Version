import { ChevronDown } from "lucide-react";

import type { MarketingFaqItem } from "@/lib/marketing/pages/types";
import {
	faqCardSurfaceClassName,
	pricingSectionGridOverlayClassName,
} from "@/lib/marketing/pricing-card-surface";
import { cn } from "@/lib/utils";

type MarketingFaqAccordionProps = {
	items: MarketingFaqItem[];
	idPrefix?: string;
	className?: string;
};

export function MarketingFaqAccordion({
	items,
	idPrefix = "faq",
	className,
}: MarketingFaqAccordionProps) {
	return (
		<div className={cn("relative", className)}>
			<div className={pricingSectionGridOverlayClassName} aria-hidden />
			<div className="relative z-10 grid gap-3 xl:grid-cols-2 xl:gap-6">
				{items.map((item) => (
					<details
						key={item.id}
						id={`${idPrefix}-${item.id}`}
						className={cn(
							"group overflow-hidden px-4 py-4 transition-shadow duration-200 ease-out medium:px-6 medium:py-6",
							faqCardSurfaceClassName,
							"open:shadow-[0_22px_55px_-28px_oklch(0.2_0.04_160/.55)]",
						)}
					>
						<summary className="flex cursor-pointer list-none items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
							<span className="border-primary/35 bg-primary/10 text-link mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums">
								{item.id}
							</span>
							<h3 className="min-w-0 flex-1 text-pretty text-lg font-semibold tracking-tight text-foreground medium:text-xl">
								{item.question}
							</h3>
							<span
								aria-hidden
								className="text-muted-foreground group-open:text-primary mt-1 transition-[transform,color] duration-200 ease-out group-open:rotate-180"
							>
								<ChevronDown className="size-5" strokeWidth={2} />
							</span>
						</summary>
						<p className="text-muted-foreground mt-3 pl-10 text-sm leading-relaxed medium:text-[15px]">
							<span className="block w-full text-pretty">{item.answer}</span>
						</p>
					</details>
				))}
			</div>
		</div>
	);
}
