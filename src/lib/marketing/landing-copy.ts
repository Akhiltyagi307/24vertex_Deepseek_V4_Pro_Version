/**
 * Parent-first homepage CTA constants. The marketing surface is built around
 * parents of grade 6 to 10 students, so the primary CTA across hero, header,
 * pricing, FAQ tail, and final-CTA bands all routes to `/signup/parent`. The
 * role-picker funnel is reserved for the small "For schools and teachers" band.
 */

/** Primary CTA label for the parent direct signup funnel. */
export const LANDING_PARENT_PRIMARY_CTA_LABEL = "Start your child's free trial";

/** Same intent as the primary CTA, shorter for tight buttons (mobile sheet). */
export const LANDING_PARENT_PRIMARY_CTA_LABEL_SHORT = "Start free trial";

/** Direct route to the parent-only signup form. */
export const LANDING_PARENT_PRIMARY_CTA_HREF = "/signup/parent";

/** Multi-role signup target. Reserved for the school/teacher reassurance band. */
export const LANDING_ROLE_SIGNUP_HREF = "/signup/role-picker";

/** Label used on the school/teacher reassurance band CTA. */
export const LANDING_SCHOOLS_CTA_LABEL = "Set up a school workspace";

/**
 * @deprecated Kept so any straggler imports keep compiling; new code should
 * use {@link LANDING_PARENT_PRIMARY_CTA_LABEL} or {@link LANDING_SCHOOLS_CTA_LABEL}.
 */
export const LANDING_ROLE_SIGNUP_PRIMARY_CTA = LANDING_PARENT_PRIMARY_CTA_LABEL;

/** Same Tailwind classes as the hero secondary pill (e.g. "Log in" / "See how it works" in `AcmeHero`).
 *  Sized to match the primary CTA (`h-9`) so the row reads as a balanced pair. */
export const LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME =
	"h-9 rounded-full px-5 text-sm font-semibold shadow-none";

/** Same gap as the hero primary / secondary row: `gap-3` when stacked, `medium:gap-4` when in a row. */
export const LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME = "gap-3 medium:gap-4";

/** Marketing subpages and site header navigation. */
export const MARKETING_NAV = {
	aiTutor: { href: "/ai-tutor", label: "AI tutor" },
	adaptivePractice: { href: "/adaptive-practice", label: "Adaptive practice" },
	parentDashboard: { href: "/parent-dashboard", label: "Parent dashboard" },
	pricing: { href: "/pricing", label: "Pricing" },
	schools: { href: "/schools", label: "For schools" },
	parents: { href: "/parents", label: "For parents" },
	teachers: { href: "/teachers", label: "For teachers" },
	help: { href: "/help", label: "Help" },
	about: { href: "/about", label: "About" },
	contact: { href: "/contact", label: "Contact" },
	security: { href: "/security", label: "Security" },
	guides: { href: "/guides", label: "Guides" },
	blog: { href: "/blog", label: "Blog" },
} as const;

export const MARKETING_SCHOOL_DEMO_CTA_LABEL = "Book a 20-minute walkthrough";
export const MARKETING_SCHOOL_DEMO_CTA_HREF = "/contact?type=school";
