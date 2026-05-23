import type { Metadata } from "next";

export function marketingPageMetadata({
	title,
	description,
	path,
}: {
	title: string;
	description: string;
	path: string;
}): Metadata {
	return {
		title,
		description,
		alternates: { canonical: path },
		openGraph: {
			title: `${title} · 24Vertex`,
			description,
			url: path,
		},
	};
}

export const MARKETING_PAGE_STATIC = {
	dynamic: "force-static" as const,
	revalidate: 86400,
};
