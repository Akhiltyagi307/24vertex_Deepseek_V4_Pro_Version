import { cn } from "@/lib/utils";

/** Feature bento tile chrome; pairs with `GlowCard` (`bg-card`) for consistent surfaces. */
export const featureBentoCardSurfaceClassName = cn("border-border text-card-foreground");

/** @deprecated Use `featureBentoCardSurfaceClassName`; kept for incremental refactors. */
export const featureBentoCardBgClassName = featureBentoCardSurfaceClassName;

export const landingFeatureBentoShell = cn(
	"border-border bg-card text-card-foreground border",
	"shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--card-foreground)_8%,transparent)]",
);
