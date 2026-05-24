import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
	marketingSectionTitleClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type MarketingSectionPad = "tight" | "default" | "generous";
type MarketingSectionSurface = "default" | "muted";

/**
 * Three padding intents so the same page can breathe differently across its
 * sections (shared design law: vary spacing for rhythm).
 *
 * - `tight`: glue a follow-up paragraph to the section above.
 * - `default`: standard section rhythm.
 * - `generous`: give the proof block the air it needs to land.
 */
const SECTION_PAD_CLASSNAMES = {
	tight: "px-4 py-10 medium:px-6 medium:py-14 xl:px-8 xl:py-16",
	default: "px-4 py-16 medium:px-6 medium:py-20 xl:px-8 xl:py-24",
	generous: "px-4 py-20 medium:px-6 medium:py-24 xl:px-8 xl:py-28",
} satisfies Record<MarketingSectionPad, string>;

const SECTION_SURFACE_CLASSNAMES = {
	default: "bg-background",
	muted: "bg-muted/40 dark:bg-muted/20",
} satisfies Record<MarketingSectionSurface, string>;

const sectionContentMax = "max-w-7xl mx-auto w-full";

type MarketingSectionProps = {
	id?: string;
	eyebrow?: string;
	title?: string;
	lead?: string;
	children: ReactNode;
	className?: string;
	centered?: boolean;
	pad?: MarketingSectionPad;
	surface?: MarketingSectionSurface;
};

export function MarketingSection({
	id,
	eyebrow,
	title,
	lead,
	children,
	className,
	centered = true,
	pad = "default",
	surface = "default",
}: MarketingSectionProps) {
	return (
		<section
			id={id}
			className={cn(
				"relative overflow-hidden",
				SECTION_SURFACE_CLASSNAMES[surface],
				SECTION_PAD_CLASSNAMES[pad],
				className,
			)}
		>
			<div className={sectionContentMax}>
				{(eyebrow || title || lead) && (
					<div
						className={cn(
							"mb-8 space-y-4 medium:mb-10 medium:space-y-6",
							centered && marketingSectionIntroWrapClassName,
						)}
					>
						{eyebrow ? (
							<div className={cn("flex", centered && "justify-center")}>
								<Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
									{eyebrow}
								</Badge>
							</div>
						) : null}
						{title ? (
							<h2 className={cn(marketingSectionTitleClassName, centered && "text-balance text-center")}>
								{title}
							</h2>
						) : null}
						{lead ? (
							<p className={cn(marketingSectionLeadClassName, centered && "text-pretty text-center")}>
								{lead}
							</p>
						) : null}
					</div>
				)}
				{children}
			</div>
		</section>
	);
}

export { sectionContentMax };
