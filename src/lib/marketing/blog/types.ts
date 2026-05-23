export type BlogPostMeta = {
	slug: string;
	title: string;
	description: string;
	publishedAt: string;
	author: string;
	tags: string[];
	/** Estimated reading time in minutes */
	readingMinutes: number;
};
