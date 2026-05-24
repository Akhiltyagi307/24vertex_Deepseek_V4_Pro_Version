import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import { MARKETING_SECTION_INTRO_MAX_CLASSNAME } from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type MarketingHeroTone = "default" | "tinted";

type MarketingHeroProps = {
	eyebrow?: string;
	title: string;
	lead: string;
	actions?: ReactNode;
	className?: string;
	/**
	 * `default` is the standard hero on a plain page surface.
	 * `tinted` adds a subtle brand-green wash + ring so the flagship feature
	 * page signals "this is THE primary intent" without flipping the whole
	 * page to a green drench.
	 */
	tone?: MarketingHeroTone;
};

export function MarketingHero({
	eyebrow,
	title,
	lead,
	actions,
	className,
	tone = "default",
}: MarketingHeroProps) {
	const tinted = tone === "tinted";

	return (
		<header
			className={cn(
				"relative overflow-hidden border-b border-border/60 px-4 py-14 medium:px-6 medium:py-20 xl:px-8 xl:py-24",
				tinted
					? "bg-[var(--subject-grid-icon)]/8 dark:bg-[var(--subject-grid-icon)]/12"
					: "bg-background",
				className,
			)}
		>
			{tinted ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--subject-grid-icon)]/40 to-transparent"
				/>
			) : null}
			<div
				className={cn(
					"relative mx-auto space-y-5 text-center medium:space-y-6",
					MARKETING_SECTION_INTRO_MAX_CLASSNAME,
				)}
			>
				{eyebrow ? (
					<div className="flex justify-center">
						<Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
							{eyebrow}
						</Badge>
					</div>
				) : null}
				<h1 className="text-balance text-3xl font-medium tracking-tight text-foreground medium:text-5xl xl:text-6xl">
					{title}
				</h1>
				<p className="text-pretty text-base leading-relaxed text-muted-foreground medium:text-lg">{lead}</p>
				{actions ? (
					<div className="flex flex-wrap items-center justify-center gap-3 pt-2 medium:gap-4">{actions}</div>
				) : null}
			</div>
		</header>
	);
}
