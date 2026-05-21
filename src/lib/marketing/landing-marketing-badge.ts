/**
 * Public marketing home: badge border reads the 24Vertex brand green (`--subject-grid-icon`)
 * for One Voice identity (DESIGN.md §2); the TEXT uses `--link` (darker brand green) so
 * the badge clears WCAG AA (4.5:1) on its own light-mint surface — `--subject-grid-icon`
 * as text on `bg-.../12` only hits ~2.9:1.
 *
 * Pass last in `cn(...)` on `<Badge>` so outline/secondary/default variants do not
 * flatten to theme neutrals.
 */
export const landingMarketingBadgeClassName =
	"min-h-6 h-6 border border-[var(--subject-grid-icon)] bg-[var(--subject-grid-icon)]/12 px-2.5 py-1 text-[13px] leading-none text-[var(--link)] shadow-none dark:bg-[var(--subject-grid-icon)]/16 dark:text-[var(--subject-grid-icon)] [&>svg]:size-3.5";

/** Small label above an `<h2>` on the landing page (Features, Benefits, Voices, Pricing, FAQ). */
export const landingMarketingSectionEyebrowBadgeClassName = landingMarketingBadgeClassName;

/** Role chip on FAQ accordion rows (`variant="secondary"` shell). */
export const landingMarketingFaqRoleBadgeClassName =
	"border-[var(--subject-grid-icon)] bg-[var(--subject-grid-icon)]/10 text-[var(--link)] dark:text-[var(--subject-grid-icon)] [a]:hover:bg-[var(--subject-grid-icon)]/14";
