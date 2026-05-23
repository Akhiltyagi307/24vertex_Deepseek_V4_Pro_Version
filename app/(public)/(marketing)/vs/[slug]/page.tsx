import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingComparisonTable } from "@/components/marketing/blocks/marketing-comparison-table";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { LANDING_PARENT_PRIMARY_CTA_HREF, MARKETING_NAV } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { getAllVsSlugs, getVsPageContent } from "@/lib/marketing/pages/vs-pages";

export const dynamic = "force-static";
export const revalidate = 86400;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
	return getAllVsSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	const page = getVsPageContent(slug);
	if (!page) return {};
	return marketingPageMetadata({
		title: `24Vertex vs ${page.brand}`,
		description: page.heroLead,
		path: `/vs/${slug}`,
	});
}

export default async function VsComparePage({ params }: PageProps) {
	const { slug } = await params;
	const page = getVsPageContent(slug);
	if (!page) notFound();

	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Compare"
				title={`24Vertex vs ${page.brand}`}
				lead={page.heroLead}
			/>

			<MarketingSection title={`What ${page.brand} is strong at`}>
				<p className="text-muted-foreground mx-auto max-w-2xl text-pretty text-base leading-relaxed">
					{page.theirStrength}
				</p>
			</MarketingSection>

			<MarketingSection title="What 24Vertex is for">
				<p className="text-muted-foreground mx-auto max-w-2xl text-pretty text-base leading-relaxed">
					{page.ourRole}
				</p>
			</MarketingSection>

			<MarketingSection title="Side by side">
				<MarketingComparisonTable otherBrand={page.brand} rows={page.comparisonRows} />
			</MarketingSection>

			<MarketingSection title="Who should pick which">
				<div className="mx-auto grid max-w-3xl gap-6 medium:grid-cols-2">
					<div>
						<h3 className="font-semibold text-foreground">Pick {page.brand} if</h3>
						<p className="text-muted-foreground mt-2 text-sm leading-relaxed">{page.whoShouldPickThem}</p>
					</div>
					<div>
						<h3 className="font-semibold text-foreground">Pick 24Vertex if</h3>
						<p className="text-muted-foreground mt-2 text-sm leading-relaxed">{page.whoShouldPickUs}</p>
					</div>
				</div>
			</MarketingSection>

			<MarketingCtaBand
				title="Try 24Vertex on your child's actual chapters"
				lead="14 days free. 5 practice tests. No card needed."
				actions={
					<>
						<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />
						<Link
							href={MARKETING_NAV.parents.href}
							className="text-link text-sm font-medium underline-offset-4 hover:underline"
						>
							Read the parent overview
						</Link>
					</>
				}
			/>
		</MarketingSubpageShell>
	);
}
