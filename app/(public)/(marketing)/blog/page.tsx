import Link from "next/link";

import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { BLOG_POSTS } from "@/lib/marketing/blog/posts";
import { LANDING_PARENT_PRIMARY_CTA_HREF, MARKETING_NAV } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { cn } from "@/lib/utils";

export const metadata = marketingPageMetadata({
	title: "Blog",
	description:
		"Resources for Indian parents on report cards, weak chapters, and calm study habits. Articles coming soon.",
	path: "/blog",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const COMING_TOPICS = [
	"How to read a CBSE report card without panic",
	"What weak chapters look like in Class 8 maths",
	"Talking to your child when marks slip",
	"When tuition helps and when practice gaps matter more",
] as const;

export default function BlogIndexPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Blog"
				title="Resources for parents, coming soon"
				lead="We are writing practical guides on report cards, chapter gaps, and study habits. No listicles. No rank guarantees."
			/>

			{BLOG_POSTS.length > 0 ? (
				<MarketingSection title="Latest">
					<ul className="mx-auto max-w-2xl space-y-4">
						{BLOG_POSTS.map((post) => (
							<li key={post.slug}>
								<Link
									href={`/blog/${post.slug}`}
									className={cn("block px-5 py-4", featureBentoCardSurfaceClassName)}
								>
									<h2 className="font-semibold text-foreground">{post.title}</h2>
									<p className="text-muted-foreground mt-1 text-sm">{post.description}</p>
								</Link>
							</li>
						))}
					</ul>
				</MarketingSection>
			) : (
				<MarketingSection title="Topics we are working on">
					<ul className="mx-auto grid max-w-xl gap-3">
						{COMING_TOPICS.map((topic) => (
							<li
								key={topic}
								className={cn("px-4 py-3 text-sm text-foreground", featureBentoCardSurfaceClassName)}
							>
								{topic}
							</li>
						))}
					</ul>
					<p className="text-muted-foreground mx-auto mt-8 max-w-lg text-center text-sm">
						Want chapter checks now? See{" "}
						<Link href={MARKETING_NAV.guides.href} className="text-link font-medium hover:underline">
							Guides
						</Link>{" "}
						or start a trial.
					</p>
				</MarketingSection>
			)}

			<MarketingSection>
				<div className="flex justify-center">
					<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />
				</div>
			</MarketingSection>
		</MarketingSubpageShell>
	);
}
