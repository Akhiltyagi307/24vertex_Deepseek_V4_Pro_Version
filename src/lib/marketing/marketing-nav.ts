/**
 * Single source of truth for marketing header, mobile sheet, and footer links.
 * Import from here so every public page shows the same navigation.
 */

export type MarketingNavIconId =
	| "practice"
	| "tutor"
	| "parent-dashboard"
	| "assignments"
	| "parents"
	| "students"
	| "schools";

export type MarketingNavItem = {
	href: string;
	label: string;
	description: string;
	icon: MarketingNavIconId;
};

/** Product capabilities (Features dropdown). */
export const MARKETING_FEATURES_NAV: readonly MarketingNavItem[] = [
	{
		href: "/adaptive-practice",
		label: "Adaptive practice",
		description: "20-minute sets on the chapters your radar chart flags this week.",
		icon: "practice",
	},
	{
		href: "/ai-tutor",
		label: "AI tutor",
		description: "Explain and Solve-with-me modes for private doubt support.",
		icon: "tutor",
	},
	{
		href: "/parent-dashboard",
		label: "Parent dashboard",
		description: "Chapter mastery radar chart updated after every practice session.",
		icon: "parent-dashboard",
	},
	{
		href: "/assignments",
		label: "Teacher assignments",
		description: "Targeted practice sets pushed to a section after a class test.",
		icon: "assignments",
	},
] as const;

/** Audience landing pages (Solutions dropdown). */
export const MARKETING_SOLUTIONS_NAV: readonly MarketingNavItem[] = [
	{
		href: "/parents",
		label: "For parents",
		description: "Catch weak chapters before report-card day.",
		icon: "parents",
	},
	{
		href: "/students",
		label: "For students",
		description: "Know which chapters to open before the unit test.",
		icon: "students",
	},
	{
		href: "/schools",
		label: "For schools & centres",
		description: "Section analytics and assignment flow for your staff.",
		icon: "schools",
	},
] as const;

export const MARKETING_UTILITY_NAV = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/help", label: "Help" },
] as const;

export type MarketingFooterSection = {
	title: string;
	links: Array<{ name: string; href: string }>;
};

export const MARKETING_FOOTER_SECTIONS: readonly MarketingFooterSection[] = [
	{
		title: "Solutions",
		links: MARKETING_SOLUTIONS_NAV.map((item) => ({ name: item.label, href: item.href })),
	},
	{
		title: "Features",
		links: MARKETING_FEATURES_NAV.map((item) => ({ name: item.label, href: item.href })),
	},
	{
		title: "Company",
		links: [
			{ name: "About", href: "/about" },
			{ name: "Security", href: "/security" },
			{ name: "Contact", href: "/contact" },
			{ name: "Guides", href: "/guides" },
		],
	},
	{
		title: "Legal",
		links: [
			{ name: "Terms", href: "/legal/terms" },
			{ name: "Privacy", href: "/legal/privacy" },
			{ name: "Refund policy", href: "/legal/refund" },
			{ name: "Shipping", href: "/legal/shipping" },
		],
	},
] as const;
