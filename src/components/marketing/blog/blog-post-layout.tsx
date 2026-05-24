import type { ReactNode } from "react";
import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";

import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import type { BlogPostMeta } from "@/lib/marketing/blog/types";
import { LANDING_PARENT_PRIMARY_CTA_HREF, LANDING_TRIAL_LEAD_FULL } from "@/lib/marketing/landing-copy";
import { MARKETING_SECTION_INTRO_MAX_CLASSNAME } from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type BlogPostLayoutProps = {
	post: BlogPostMeta;
	children: ReactNode;
};

export function BlogPostLayout({ post, children }: BlogPostLayoutProps) {
	const date = new Date(post.publishedAt).toLocaleDateString("en-IN", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<article className="bg-background">
			<header className="border-border/60 border-b px-4 py-14 medium:px-6 medium:py-20 xl:px-8">
				<div className={cn("mx-auto space-y-4", MARKETING_SECTION_INTRO_MAX_CLASSNAME)}>
					<p className="text-muted-foreground text-sm">
						<time dateTime={post.publishedAt}>{date}</time>
						<span aria-hidden> · </span>
						<span>{post.readingMinutes} min read</span>
						<span aria-hidden> · </span>
						<span>{post.author}</span>
					</p>
					<h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground medium:text-4xl">
						{post.title}
					</h1>
					<p className="text-pretty text-lg text-muted-foreground">{post.description}</p>
					{post.tags.length > 0 ? (
						<ul className="flex flex-wrap gap-2 pt-2">
							{post.tags.map((tag) => (
								<li
									key={tag}
									className="border-border/60 rounded-full border bg-muted/20 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
								>
									{tag}
								</li>
							))}
						</ul>
					) : null}
				</div>
			</header>

			<div
				className={cn(
					"prose prose-neutral dark:prose-invert mx-auto px-4 py-12 medium:px-6 xl:px-8",
					MARKETING_SECTION_INTRO_MAX_CLASSNAME,
				)}
			>
				{children}
			</div>

			<MarketingCtaBand
				title="Put these ideas into practice"
				lead={LANDING_TRIAL_LEAD_FULL}
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>
		</article>
	);
}
