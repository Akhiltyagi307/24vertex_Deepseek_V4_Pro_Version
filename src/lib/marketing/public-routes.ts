import {
	getAllBoardSlugs,
	getAllGradeSlugs,
	getAllSubjectSlugs,
} from "@/lib/marketing/seo/registry";
import { getAllVsSlugs } from "@/lib/marketing/pages/vs-pages";

/** Static marketing pages (no dynamic segments). */
export const PUBLIC_MARKETING_STATIC_PATHS = [
	"/about",
	"/contact",
	"/security",
	"/parents",
	"/students",
	"/schools",
	"/teachers",
	"/ai-tutor",
	"/adaptive-practice",
	"/parent-dashboard",
	"/assignments",
	"/pricing",
	"/help",
	"/guides",
	"/blog",
] as const;

export const PUBLIC_LEGAL_PATHS = [
	"/legal/terms",
	"/legal/privacy",
	"/legal/refund",
	"/legal/shipping",
] as const;

export type PublicMarketingStaticPath = (typeof PUBLIC_MARKETING_STATIC_PATHS)[number];

/** All indexable public paths for sitemap generation. */
export function getPublicSitemapPaths(): string[] {
	const boardPaths = getAllBoardSlugs().map((slug) => `/boards/${slug}`);
	const gradePaths = getAllGradeSlugs().map((grade) => `/grades/${grade}`);
	const subjectPaths = getAllSubjectSlugs().map((slug) => `/subjects/${slug}`);
	const vsPaths = getAllVsSlugs().map((slug) => `/vs/${slug}`);

	return [
		"/",
		...PUBLIC_MARKETING_STATIC_PATHS,
		...PUBLIC_LEGAL_PATHS,
		...boardPaths,
		...gradePaths,
		...subjectPaths,
		...vsPaths,
	];
}
