import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import { cn } from "@/lib/utils";

type MarketingFeatureSpotlightProps = {
	icon: LucideIcon;
	title: string;
	body: string;
	className?: string;
	/**
	 * Optional eyebrow chip above the title. When omitted, no badge renders
	 * (the previous "At a glance" default was template tax that doubled the
	 * page-level eyebrow on every feature page). Pass a specific in-context
	 * label only when it earns its place.
	 */
	badge?: string;
};

/** Compact highlight card for feature landing pages. */
export function MarketingFeatureSpotlight({
	icon: Icon,
	title,
	body,
	className,
	badge,
}: MarketingFeatureSpotlightProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-4 px-5 py-6 medium:flex-row medium:items-start medium:gap-6 medium:px-7 medium:py-8",
				featureBentoCardSurfaceClassName,
				className,
			)}
		>
			<span
				className="border-border bg-muted/45 ring-border/60 flex size-12 shrink-0 items-center justify-center rounded-xl border ring-1"
				aria-hidden
			>
				<Icon className="size-6 text-[var(--subject-grid-icon)]" strokeWidth={2} />
			</span>
			<div className="space-y-2">
				{badge ? (
					<Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
						{badge}
					</Badge>
				) : null}
				<h2 className="text-foreground text-pretty text-xl font-semibold tracking-tight medium:text-2xl">
					{title}
				</h2>
				<p className="text-muted-foreground max-w-[65ch] text-pretty text-sm leading-relaxed medium:text-base">
					{body}
				</p>
			</div>
		</div>
	);
}
