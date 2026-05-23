import { notFound } from "next/navigation";

import { BlogPostLayout } from "@/components/marketing/blog/blog-post-layout";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { getAllBlogSlugs, getBlogPostBySlug } from "@/lib/marketing/blog/posts";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";

export const dynamic = "force-static";
export const revalidate = 86400;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
	return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	const post = getBlogPostBySlug(slug);
	if (!post) return {};
	return marketingPageMetadata({
		title: post.title,
		description: post.description,
		path: `/blog/${slug}`,
	});
}

/**
 * Blog article template. Register posts in `src/lib/marketing/blog/posts.ts`
 * and add a case below (or MDX loader) for body content.
 */
export default async function BlogPostPage({ params }: PageProps) {
	const { slug } = await params;
	const post = getBlogPostBySlug(slug);
	if (!post) notFound();

	return (
		<MarketingSubpageShell>
			<BlogPostLayout post={post}>
				<p>Article body for &ldquo;{post.title}&rdquo; goes here when published.</p>
			</BlogPostLayout>
		</MarketingSubpageShell>
	);
}
