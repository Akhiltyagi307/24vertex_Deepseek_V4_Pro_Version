import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
	marketingSectionTitleClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

const sectionShell =
	"w-full px-4 py-16 medium:px-6 medium:py-20 xl:px-8 xl:py-24";
const sectionContentMax = "max-w-7xl mx-auto w-full";
const sectionTitle = marketingSectionTitleClassName;
const sectionLead = marketingSectionLeadClassName;

type MarketingSectionProps = {
	id?: string;
	eyebrow?: string;
	title?: string;
	lead?: string;
	children: ReactNode;
	className?: string;
	centered?: boolean;
};

export function MarketingSection({
	id,
	eyebrow,
	title,
	lead,
	children,
	className,
	centered = true,
}: MarketingSectionProps) {
	return (
		<section id={id} className={cn("relative overflow-hidden bg-background", sectionShell, className)}>
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
							<h2 className={cn(sectionTitle, centered && "text-balance text-center")}>{title}</h2>
						) : null}
						{lead ? (
							<p className={cn(sectionLead, centered && "text-pretty text-center")}>{lead}</p>
						) : null}
					</div>
				)}
				{children}
			</div>
		</section>
	);
}

export { sectionShell, sectionContentMax, sectionTitle, sectionLead };
