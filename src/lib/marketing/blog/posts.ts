import type { BlogPostMeta } from "@/lib/marketing/blog/types";

/**
 * Published blog posts. Empty until editorial content ships.
 * To add a post: append metadata here and implement body in blog/[slug]/page.tsx
 * (or migrate to MDX). Do not add slugs to the sitemap until published.
 */
export const BLOG_POSTS: BlogPostMeta[] = [];

export function getBlogPostBySlug(slug: string): BlogPostMeta | undefined {
	return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getAllBlogSlugs(): string[] {
	return BLOG_POSTS.map((p) => p.slug);
}
