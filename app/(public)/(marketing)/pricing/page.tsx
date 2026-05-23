import Link from "next/link";

import { MarketingFaqAccordion } from "@/components/marketing/blocks/marketing-faq-accordion";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { Pricing } from "@/components/ui/single-pricing-card-1";
import { getAppUrl } from "@/lib/env";
import { LANDING_PARENT_PRIMARY_CTA_HREF } from "@/lib/marketing/landing-copy";
import { HELP_FAQ_CATEGORIES } from "@/lib/marketing/pages/help-faq";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";

export const metadata = marketingPageMetadata({
	title: "Pricing",
	description:
		"24Vertex parent plan: monthly and yearly pricing, 14-day free trial with 5 practice tests and AI tutor. Less than a week of many home tuitions.",
	path: "/pricing",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const BILLING_FAQ = HELP_FAQ_CATEGORIES.find((c) => c.id === "billing")?.items ?? [];

function resolveBaseUrl(): string {
	try {
		return getAppUrl();
	} catch {
		return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
	}
}

export default function PricingPage() {
	const base = resolveBaseUrl();
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Product",
		name: "24Vertex parent plan",
		description: "Adaptive AI practice, tutor, and parent dashboard for grades 6 to 10.",
		brand: { "@type": "Brand", name: "24Vertex" },
		offers: [
			{
				"@type": "Offer",
				name: "Monthly",
				price: "1000",
				priceCurrency: "INR",
				url: `${base}${LANDING_PARENT_PRIMARY_CTA_HREF}`,
			},
			{
				"@type": "Offer",
				name: "Yearly",
				price: "10000",
				priceCurrency: "INR",
				url: `${base}${LANDING_PARENT_PRIMARY_CTA_HREF}`,
			},
		],
	};

	return (
		<MarketingSubpageShell>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<MarketingHero
				eyebrow="Pricing"
				title="One plan. Monthly to try, yearly to save two months."
				lead="Less than the cost of one week of most home tuitions, for a private AI tutor and a parent dashboard your child's school does not give you."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>

			<Pricing />

			<MarketingSection eyebrow="Billing" title="Pricing questions">
				<MarketingFaqAccordion items={BILLING_FAQ} idPrefix="billing" />
				<p className="text-muted-foreground mt-6 text-center text-sm">
					Refunds:{" "}
					<Link href="/legal/refund" className="text-link font-medium hover:underline">
						Refund policy
					</Link>
				</p>
			</MarketingSection>

			<div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 p-3 backdrop-blur-md medium:hidden">
				<div className="pointer-events-auto mx-auto max-w-md">
					<LandingPrimaryCtaButton
						className="h-11 w-full justify-center"
						render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />}
					/>
				</div>
			</div>
		</MarketingSubpageShell>
	);
}
