import type { Metadata } from "next";

import { Providers } from "@/components/providers";

const PARENT_FIRST_TITLE =
	"24Vertex: Catch your child's weak chapters before report-card day";
const PARENT_FIRST_DESCRIPTION =
	"For parents of grade 6 to 10 students. 24Vertex is the layer your child's school does not have time to give: adaptive AI practice on the chapters they actually missed, a private Explain and Solve-with-me tutor for the doubts they would never raise in class, and a chapter-level dashboard you, your child, and their teacher all read from.";

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
		default: PARENT_FIRST_TITLE,
		template: "%s · 24Vertex",
	},
	description: PARENT_FIRST_DESCRIPTION,
	applicationName: "24Vertex",
	openGraph: {
		type: "website",
		siteName: "24Vertex",
		locale: "en_IN",
		url: "/",
		title: PARENT_FIRST_TITLE,
		description: PARENT_FIRST_DESCRIPTION,
	},
	twitter: {
		card: "summary_large_image",
		title: PARENT_FIRST_TITLE,
		description: PARENT_FIRST_DESCRIPTION,
	},
	robots: {
		index: true,
		follow: true,
	},
};

export default function PublicLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return <Providers>{children}</Providers>;
}
