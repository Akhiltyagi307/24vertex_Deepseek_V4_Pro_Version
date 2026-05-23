import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import { MARKETING_SECTION_INTRO_MAX_CLASSNAME } from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type MarketingHeroProps = {
	eyebrow?: string;
	title: string;
	lead: string;
	actions?: ReactNode;
	className?: string;
};

export function MarketingHero({ eyebrow, title, lead, actions, className }: MarketingHeroProps) {
	return (
		<header
			className={cn(
				"border-border/60 border-b bg-background px-4 py-14 medium:px-6 medium:py-20 xl:px-8 xl:py-24",
				className,
			)}
		>
			<div
				className={cn(
					"mx-auto space-y-5 text-center medium:space-y-6",
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
