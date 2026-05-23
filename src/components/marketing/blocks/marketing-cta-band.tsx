import type { ReactNode } from "react";

import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import { MARKETING_SECTION_LEAD_MAX_CLASSNAME } from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type MarketingCtaBandProps = {
	title: string;
	lead: string;
	actions: ReactNode;
	className?: string;
};

export function MarketingCtaBand({ title, lead, actions, className }: MarketingCtaBandProps) {
	return (
		<section className={cn("bg-background px-4 py-16 medium:px-6 medium:py-20 xl:px-8", className)}>
			<div
				className={cn(
					"relative mx-auto max-w-7xl overflow-hidden rounded-2xl px-6 py-14 text-center medium:px-10 medium:py-16",
					landingFeatureBentoShell,
				)}
			>
				<h2 className="text-balance text-2xl font-semibold tracking-tight text-card-foreground medium:text-3xl">
					{title}
				</h2>
				<p
					className={cn(
						"text-muted-foreground mx-auto mt-3 text-pretty text-base medium:text-lg",
						MARKETING_SECTION_LEAD_MAX_CLASSNAME,
					)}
				>
					{lead}
				</p>
				<div className="mt-8 flex flex-wrap items-center justify-center gap-3 medium:gap-4">{actions}</div>
			</div>
		</section>
	);
}
