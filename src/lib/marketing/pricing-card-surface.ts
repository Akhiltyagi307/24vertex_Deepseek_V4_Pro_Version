import { cn } from "@/lib/utils";

import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";

/** Pricing tier cards: same `bg-card` chrome as the home CTA band (`landingFeatureBentoShell`). */
export const pricingTierCardSurfaceClassName = cn("rounded-lg", landingFeatureBentoShell);

/** FAQ accordions and FAQ footer strip: same `--card` fill as Features bento (GlowCard). */
export const faqCardSurfaceClassName = cn(
	"rounded-lg border border-border bg-card text-card-foreground",
	"shadow-[0_18px_50px_-30px_oklch(0.2_0.02_170/.75)]",
);

/** Full-bleed grid overlay behind pricing and FAQ clusters. */
export const pricingSectionGridOverlayClassName = cn(
	"pointer-events-none absolute inset-0 z-[1] hidden size-full md:block",
	"bg-[linear-gradient(to_right,--theme(--color-foreground/.2)_1px,transparent_1px),linear-gradient(to_bottom,--theme(--color-foreground/.2)_1px,transparent_1px)]",
	"bg-[size:32px_32px]",
	"[mask-image:radial-gradient(ellipse_at_center,var(--background)_10%,transparent)]",
);
