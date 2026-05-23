import Link from "next/link";

import { LandingOutcomesStrip } from "@/components/marketing/landing-outcomes-strip";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { LandingProblemSection } from "@/components/marketing/landing-problem-section";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingFaqAccordion } from "@/components/marketing/blocks/marketing-faq-accordion";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import Testimonials from "@/components/ui/testimonials";
import { Pricing } from "@/components/ui/single-pricing-card-1";
import {
	LANDING_PARENT_PRIMARY_CTA_HREF,
	MARKETING_NAV,
} from "@/lib/marketing/landing-copy";
import { HELP_FAQ_CATEGORIES } from "@/lib/marketing/pages/help-faq";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";

export const metadata = marketingPageMetadata({
	title: "For parents",
	description:
		"Catch your child's weak chapters before report-card day. Adaptive practice, private AI tutor, and a chapter-level parent dashboard for grades 6 to 10.",
	path: "/parents",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const PARENT_FAQ_PREVIEW = HELP_FAQ_CATEGORIES.find((c) => c.id === "parents")?.items.slice(0, 5) ?? [];

export default function ParentsPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="For parents"
				title="Stop finding out on report-card day."
				lead="For parents of grade 6 to 10 students. CBSE, ICSE, and state boards. See which chapters need 20 minutes this week, without the nightly interrogation."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>

			<MarketingSection eyebrow="A Sunday evening" title="What changes when you can see the heatmap">
				<div className="text-muted-foreground mx-auto max-w-2xl space-y-4 text-pretty text-base leading-relaxed medium:text-lg">
					<p>
						It is 7 PM. Your child says studies are fine. The unit test is Thursday. Last term, marks
						slipped in two chapters you did not know were weak until the report card.
					</p>
					<p>
						With 24Vertex, you open the parent dashboard: three chapters in amber, one in red. Your child
						runs a 20-minute practice set on the red one. The AI tutor answers the doubt they would not
						ask in tuition. By Wednesday, the heatmap shifts. You did not nag. You acted on data.
					</p>
				</div>
			</MarketingSection>

			<LandingProblemSection />
			<LandingOutcomesStrip />
			<Testimonials />

			<MarketingSection eyebrow="FAQ" title="Questions parents ask before paying">
				<MarketingFaqAccordion items={PARENT_FAQ_PREVIEW} idPrefix="parents" />
				<p className="text-muted-foreground mt-6 text-center text-sm">
					<Link href={MARKETING_NAV.help.href} className="text-link font-medium underline-offset-4 hover:underline">
						See all questions in Help
					</Link>
				</p>
			</MarketingSection>

			<Pricing />

			<MarketingCtaBand
				title="This weekend, find out the three chapters dragging marks down"
				lead="14 days free. 5 practice tests. AI tutor included. No card needed."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>
		</MarketingSubpageShell>
	);
}
