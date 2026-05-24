/**
 * Parent-first homepage CTA constants. The marketing surface is built around
 * parents of grade 6 to 10 students, so the primary CTA across hero, header,
 * pricing, FAQ tail, and final-CTA bands all routes to `/signup/parent`. The
 * role-picker funnel is reserved for the small "For schools and teachers" band.
 */

/** Primary CTA label for the parent direct signup funnel. */
export const LANDING_PARENT_PRIMARY_CTA_LABEL = "Start free trial";

/** Ultra-short parent CTA for very tight layouts (sticky bars, narrow cards). */
export const LANDING_PARENT_PRIMARY_CTA_LABEL_SHORT = "Try free";

/** Direct route to the parent-only signup form. */
export const LANDING_PARENT_PRIMARY_CTA_HREF = "/signup/parent";

/** Primary CTA for the student audience landing page. */
export const LANDING_STUDENT_PRIMARY_CTA_LABEL = "Sign up free";

/** Student signup wizard (grades 6 to 10). */
export const LANDING_STUDENT_PRIMARY_CTA_HREF = "/signup/student";

/** Secondary CTA on the students page (share funnel with parent). */
export const LANDING_STUDENT_SHARE_PARENT_CTA_LABEL = "Share with parent";

/**
 * Primary CTA on student-voiced feature pages (`/adaptive-practice`, `/ai-tutor`).
 * Still routes to parent signup; the label makes the payer explicit (no student signup).
 */
export const LANDING_STUDENT_FEATURE_PARENT_CTA_LABEL = "Start trial with parent";

/** Bridge line under hero CTAs on student-voiced feature pages. */
export const LANDING_STUDENT_FEATURE_PARENT_CTA_NOTE =
	"A parent starts the 14-day trial and links your account. No card needed.";

/** Multi-role signup target. Reserved for the school/teacher reassurance band. */
export const LANDING_ROLE_SIGNUP_HREF = "/signup/role-picker";

/** Label used on the school/teacher reassurance band CTA. */
export const LANDING_SCHOOLS_CTA_LABEL = "Set up school";

/** Pricing tier CTAs (amount is shown above the button). */
export const LANDING_PRICING_MONTHLY_CTA_LABEL = "Try free";
export const LANDING_PRICING_YEARLY_CTA_LABEL = "Try free";

/** Homepage schools band primary button. */
export const LANDING_SCHOOLS_OVERVIEW_CTA_LABEL = "For schools";

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
	assignments: { href: "/assignments", label: "Teacher assignments" },
	pricing: { href: "/pricing", label: "Pricing" },
	schools: { href: "/schools", label: "For schools & centres" },
	parents: { href: "/parents", label: "For parents" },
	students: { href: "/students", label: "For students" },
	teachers: { href: "/schools#for-teachers", label: "For teachers" },
	help: { href: "/help", label: "Help" },
	about: { href: "/about", label: "About" },
	contact: { href: "/contact", label: "Contact" },
	security: { href: "/security", label: "Security" },
	guides: { href: "/guides", label: "Guides" },
	blog: { href: "/blog", label: "Blog" },
} as const;

export const MARKETING_SCHOOL_DEMO_CTA_LABEL = "Book demo";
export const MARKETING_SCHOOL_DEMO_CTA_HREF = "/contact?type=school";

/** Primary school / institution demo CTA (hero, pilot band, footer CTA). */
export const LANDING_SCHOOL_DEMO_CTA_BUTTON_CLASSNAME =
	"h-11 rounded-full bg-[var(--subject-grid-icon)] px-5 font-semibold text-white shadow-none transition-[opacity,transform] duration-200 ease-out hover:opacity-95 active:scale-[0.99]";

/** Secondary school CTA paired with the demo button on marketing subpages. */
export const LANDING_SCHOOL_SECONDARY_CTA_BUTTON_CLASSNAME = "h-11 rounded-full px-5 font-semibold";

/**
 * Canonical 14-day trial copy. Reuse verbatim across CTA bands, hero leads,
 * pricing, and FAQs so trial framing stays coherent on every page. If the trial
 * shape changes, update only here.
 *
 * `_LEAD_FULL` is the standard CTA-band lead (most surfaces).
 * `_LEAD_SHORT` is for tight layouts where the lead must fit in one line.
 * `_BODY_DETAIL` is for inline body copy that needs to disambiguate practice
 * sessions (20 minutes, unlimited during trial) from practice tests (longer,
 * 5 included in the trial).
 */
export const LANDING_TRIAL_LEAD_FULL =
	"14 days free. 5 practice tests (1 hour or 3 hours each). AI tutor included. No card needed.";
export const LANDING_TRIAL_LEAD_SHORT = "14 days free. No card needed.";
export const LANDING_TRIAL_BODY_DETAIL =
	"Your 14-day trial includes unlimited 20-minute adaptive practice sessions, 5 longer practice tests (1 hour or 3 hours each), and the AI tutor. No card needed to start.";

/** School / teacher marketing CTA band lead (assignments, schools funnel). */
export const LANDING_SCHOOL_CTA_LEAD =
	"Twenty-minute walkthrough with your academic lead. Or set up a school workspace and invite your teachers.";
