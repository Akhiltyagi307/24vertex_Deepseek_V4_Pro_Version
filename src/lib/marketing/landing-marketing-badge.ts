/**
 * Public marketing home: same greens as the rest of the product (`--primary` tint + `--subject-grid-icon` rim/label, brand #2ea070).
 * Pass last in `cn(...)` on `<Badge>` so outline/secondary variants do not flatten to theme neutrals.
 */
export const landingMarketingBadgeClassName =
	"min-h-6 h-6 border border-subject-grid-icon bg-primary/12 px-2.5 py-1 text-[13px] leading-none text-subject-grid-icon shadow-none dark:bg-primary/16 [&>svg]:size-3.5";

/** Small label above an `<h2>` on the landing page (Features, Benefits, Voices, Pricing, FAQ). */
export const landingMarketingSectionEyebrowBadgeClassName = landingMarketingBadgeClassName;
