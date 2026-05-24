import type { ReactNode } from "react";

import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import { MARKETING_SECTION_LEAD_MAX_CLASSNAME } from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type MarketingCtaBandTone = "default" | "committed";

type MarketingCtaBandProps = {
	title: string;
	lead: string;
	actions: ReactNode;
	className?: string;
	/**
	 * `default` keeps the card surface chrome. `committed` paints the band in
	 * brand green (DESIGN.md "Committed" color strategy) for the moment of
	 * highest commercial intent on a marketing page.
	 */
	tone?: MarketingCtaBandTone;
};

export function MarketingCtaBand({
	title,
	lead,
	actions,
	className,
	tone = "default",
}: MarketingCtaBandProps) {
	const committed = tone === "committed";

	return (
		<section className={cn("bg-background px-4 py-16 medium:px-6 medium:py-20 xl:px-8", className)}>
			<div
				className={cn(
					"relative mx-auto max-w-7xl overflow-hidden rounded-2xl px-6 py-16 text-center medium:px-10 medium:py-20",
					committed
						? "border border-[var(--subject-grid-icon)]/30 bg-[var(--subject-grid-icon)] text-white shadow-[0_18px_60px_-30px_rgba(46,160,112,0.65)]"
						: landingFeatureBentoShell,
				)}
			>
				{committed ? (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_60%)]"
					/>
				) : null}
				<h2
					className={cn(
						"relative text-balance text-3xl font-semibold tracking-tight medium:text-4xl xl:text-5xl",
						committed ? "text-white" : "text-card-foreground",
					)}
				>
					{title}
				</h2>
				<p
					className={cn(
						"relative mx-auto mt-4 text-pretty text-base medium:text-lg",
						MARKETING_SECTION_LEAD_MAX_CLASSNAME,
						committed ? "text-white/90" : "text-muted-foreground",
					)}
				>
					{lead}
				</p>
				<div className="relative mt-8 flex flex-wrap items-center justify-center gap-3 medium:gap-4">
					{actions}
				</div>
			</div>
		</section>
	);
}
