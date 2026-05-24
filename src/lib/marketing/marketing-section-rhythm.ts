/**
 * Shared max-widths for marketing section intros (eyebrow, h2, lead).
 * Wider than the previous max-w-3xl / max-w-2xl pairing so long headlines
 * and leads use more of the content band on laptop screens.
 */

/** Centered block containing eyebrow badge + section title. */
export const MARKETING_SECTION_INTRO_MAX_CLASSNAME = "max-w-5xl";

/** Lead paragraph directly under a section title. */
export const MARKETING_SECTION_LEAD_MAX_CLASSNAME = "max-w-4xl";

/** Wider centered narrative blocks (scene-setting stories under section titles). */
export const MARKETING_SECTION_NARRATIVE_MAX_CLASSNAME = "max-w-6xl";

export const marketingSectionIntroWrapClassName = `mx-auto ${MARKETING_SECTION_INTRO_MAX_CLASSNAME} text-center`;

export const marketingSectionLeadClassName = `mx-auto mt-3 ${MARKETING_SECTION_LEAD_MAX_CLASSNAME} text-base text-muted-foreground medium:text-lg`;

export const marketingSectionTitleClassName =
	"text-3xl font-semibold tracking-tight text-foreground medium:text-4xl";

/** Scene-setting body copy under a centered MarketingSection title. */
export const marketingSectionNarrativeClassName = [
	`mx-auto ${MARKETING_SECTION_NARRATIVE_MAX_CLASSNAME}`,
	"space-y-4 text-center text-pretty text-base leading-relaxed text-muted-foreground medium:text-lg",
].join(" ");
