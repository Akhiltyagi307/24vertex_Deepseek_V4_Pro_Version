import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingProofStrip } from "@/components/marketing/blocks/marketing-proof-strip";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { LANDING_PARENT_PRIMARY_CTA_HREF } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";

export const metadata = marketingPageMetadata({
	title: "Parent dashboard",
	description:
		"Chapter-level mastery heatmap and weekly signals so Indian parents see weak chapters before report-card day.",
	path: "/parent-dashboard",
});

export const dynamic = "force-static";
export const revalidate = 86400;

export default function ParentDashboardPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Parent dashboard"
				title="The Sunday report you do not have to interrogate your child for."
				lead="A chapter heatmap you, your child, and their linked teacher can read from. Updated as practice lands, not only when marks arrive."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>

			<MarketingSection title="Reading the heatmap">
				<ul className="text-muted-foreground mx-auto max-w-2xl space-y-3 text-base leading-relaxed">
					<li>
						<strong className="text-foreground">Green:</strong> chapter is in a good place for now.
					</li>
					<li>
						<strong className="text-foreground">Amber:</strong> needs attention this week.
					</li>
					<li>
						<strong className="text-foreground">Red:</strong> priority before the next school assessment.
					</li>
				</ul>
			</MarketingSection>

			<MarketingSection title="What you see each week">
				<p className="text-muted-foreground mx-auto max-w-2xl text-pretty text-center text-base leading-relaxed">
					Week 1: two amber maths chapters. Week 2: one turns green after practice. Week 3: a new amber
					science chapter appears before the school announces the test. You act on the list, not on
					guessing.
				</p>
			</MarketingSection>

			<MarketingSection title="Parent portal">
				<MarketingProofStrip
					src="/marketing/parent-portal-dashboard.png"
					alt="24Vertex parent dashboard chapter mastery heatmap"
					caption="Parent view: chapter mastery across subjects."
				/>
			</MarketingSection>

			<MarketingCtaBand
				title="Get the first weak-chapter report in your trial"
				lead="14 days free. 5 practice tests. No card needed."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>
		</MarketingSubpageShell>
	);
}
