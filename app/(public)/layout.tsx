import type { Metadata } from "next";

/**
 * Public/marketing surface layout. Carries the metadata previously hosted on
 * the root layout, but stays static-friendly (no `dynamic = 'force-dynamic'`)
 * so the landing page and legal subtree can be served from the edge cache.
 *
 * Authenticated portals (admin, student, teacher, parent) live under sibling
 * route groups and each opt themselves into dynamic rendering via their own
 * request-scoped Supabase reads — so removing `force-dynamic` here does not
 * regress them.
 */
export const metadata: Metadata = {
	title: {
		default: "EduAI — Adaptive practice for grades 6 to 12",
		template: "%s · EduAI",
	},
	description:
		"Adaptive assessment, parent visibility, and class-level signals — one product for students, parents, and teachers.",
	applicationName: "EduAI",
	openGraph: {
		type: "website",
		siteName: "EduAI",
		locale: "en_IN",
		url: "/",
		title: "EduAI — Adaptive practice for grades 6 to 12",
		description:
			"Adaptive assessment, parent visibility, and class-level signals — one product for students, parents, and teachers.",
	},
	twitter: {
		card: "summary_large_image",
		title: "EduAI — Adaptive practice for grades 6 to 12",
		description:
			"Adaptive assessment, parent visibility, and class-level signals — one product for students, parents, and teachers.",
	},
	robots: {
		index: true,
		follow: true,
	},
};

export default function PublicLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return <>{children}</>;
}
