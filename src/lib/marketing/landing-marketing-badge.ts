/**
 * Public marketing home: accent #3ECF8E for badge border/text (matches hero headline).
 * Pass last in `cn(...)` on `<Badge>` so outline/secondary/default variants do not flatten to theme neutrals.
 */
export const landingMarketingBadgeClassName =
	"min-h-6 h-6 border border-[#3ECF8E] bg-[#3ECF8E]/12 px-2.5 py-1 text-[13px] leading-none text-[#3ECF8E] shadow-none dark:bg-[#3ECF8E]/16 [&>svg]:size-3.5";

/** Small label above an `<h2>` on the landing page (Features, Benefits, Voices, Pricing, FAQ). */
export const landingMarketingSectionEyebrowBadgeClassName = landingMarketingBadgeClassName;

/** Role chip on FAQ accordion rows (`variant="secondary"` shell). */
export const landingMarketingFaqRoleBadgeClassName =
	"border-[#3ECF8E] bg-[#3ECF8E]/10 text-[#3ECF8E] [a]:hover:bg-[#3ECF8E]/14";
