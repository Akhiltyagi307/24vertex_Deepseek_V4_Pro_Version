import Link from "next/link";

import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { HelpFaqSearch } from "@/components/marketing/help/help-faq-search";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { getAllHelpFaqItems } from "@/lib/marketing/pages/help-faq";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { LANDING_PARENT_PRIMARY_CTA_HREF } from "@/lib/marketing/landing-copy";

export const metadata = marketingPageMetadata({
	title: "Help",
	description:
		"Answers for parents, students, schools, billing, and privacy on 24Vertex. Honest FAQ without sales gloss.",
	path: "/help",
});

export const dynamic = "force-static";
export const revalidate = 86400;

export default function HelpPage() {
	const faqItems = getAllHelpFaqItems();
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqItems.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	};

	return (
		<MarketingSubpageShell>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<MarketingHero
				eyebrow="Help"
				title="Questions parents, students, and schools actually ask"
				lead="Search or browse by topic. If something is missing, contact us and we will add it."
			/>

			<MarketingSection className="!pt-0">
				<HelpFaqSearch />
				<p className="text-muted-foreground mt-10 text-center text-sm">
					Still stuck?{" "}
					<Link href="/contact" className="text-link font-medium hover:underline">
						Contact us
					</Link>{" "}
					or{" "}
					<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} className="text-link font-medium hover:underline">
						start the free trial
					</Link>
					.
				</p>
			</MarketingSection>
		</MarketingSubpageShell>
	);
}
