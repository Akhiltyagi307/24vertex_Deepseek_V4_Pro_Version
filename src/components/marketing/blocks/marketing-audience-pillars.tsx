import type { LucideIcon } from "lucide-react";

import { GlowCard } from "@/components/ui/spotlight-card";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { cn } from "@/lib/utils";

export type AudiencePillar = {
	icon: LucideIcon;
	step: string;
	title: string;
	body: string;
	bullets: string[];
};

type MarketingAudiencePillarsProps = {
	pillars: AudiencePillar[];
	className?: string;
};

export function MarketingAudiencePillars({ pillars, className }: MarketingAudiencePillarsProps) {
	return (
		<ol className={cn("grid grid-cols-1 gap-4 medium:grid-cols-3 medium:gap-6", className)}>
			{pillars.map((pillar) => {
				const Icon = pillar.icon;
				return (
					<li key={pillar.step} className="min-w-0">
						<GlowCard
							glowColor="green"
							customSize
							className={cn(
								"h-full w-full overflow-hidden rounded-[12px] border p-5 medium:p-6",
								featureBentoCardSurfaceClassName,
							)}
						>
							<div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
								<div className="flex items-center gap-3">
									<span
										className="border-border bg-muted/45 ring-border/60 flex size-10 shrink-0 items-center justify-center rounded-xl border ring-1"
										aria-hidden
									>
										<Icon className="size-5 text-[var(--subject-grid-icon)]" strokeWidth={2} />
									</span>
									<p className="text-link text-xs font-semibold tabular-nums">{pillar.step}</p>
								</div>
								<div className="space-y-2">
									<h3 className="text-foreground text-pretty text-lg font-semibold tracking-tight medium:text-xl">
										{pillar.title}
									</h3>
									<p className="text-muted-foreground text-pretty text-sm leading-relaxed medium:text-[15px]">
										{pillar.body}
									</p>
								</div>
								<ul className="text-muted-foreground mt-auto space-y-2 text-sm leading-relaxed">
									{pillar.bullets.map((bullet) => (
										<li key={bullet} className="flex items-start gap-2">
											<span
												className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--subject-grid-icon)]"
												aria-hidden
											/>
											<span className="min-w-0 text-pretty">{bullet}</span>
										</li>
									))}
								</ul>
							</div>
						</GlowCard>
					</li>
				);
			})}
		</ol>
	);
}
