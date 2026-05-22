export const FEEDBACK_PORTALS = ["student", "teacher", "parent"] as const;
export type FeedbackPortal = (typeof FEEDBACK_PORTALS)[number];

export const FEEDBACK_CATEGORIES = ["bug", "crash", "stuck", "suggestion", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_IMPACTS = ["blocked", "major", "minor"] as const;
export type FeedbackImpact = (typeof FEEDBACK_IMPACTS)[number];

export const FEEDBACK_STATUSES = ["open", "triaged", "resolved", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_CATEGORIES_WITH_IMPACT: FeedbackCategory[] = ["bug", "crash", "stuck"];

export function portalMatchesProfileRole(portal: FeedbackPortal, role: string): boolean {
	return portal === role;
}
