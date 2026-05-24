import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingFaqAccordion } from "@/components/marketing/blocks/marketing-faq-accordion";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingTrustBullets } from "@/components/marketing/blocks/marketing-trust-bullets";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { LANDING_PARENT_PRIMARY_CTA_HREF, LANDING_TRIAL_LEAD_FULL } from "@/lib/marketing/landing-copy";
import { MARKETING_SECTION_LEAD_MAX_CLASSNAME } from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";
import type { MarketingFaqItem } from "@/lib/marketing/pages/types";

export type SeoLandingTemplateProps = {
	eyebrow: string;
	title: string;
	lead: string;
	coverageTitle: string;
	coverageBody: string;
	exampleChapters: string[];
	mapTitle: string;
	mapBody: string;
	faq: MarketingFaqItem[];
	relatedLinks: { href: string; label: string }[];
	utmContent: string;
};

export function SeoLandingTemplate({
	eyebrow,
	title,
	lead,
	coverageTitle,
	coverageBody,
	exampleChapters,
	mapTitle,
	mapBody,
	faq,
	relatedLinks,
	utmContent,
}: SeoLandingTemplateProps) {
	const trialHref = `${LANDING_PARENT_PRIMARY_CTA_HREF}?utm_content=${utmContent}`;

	return (
		<>
			<MarketingHero
				eyebrow={eyebrow}
				title={title}
				lead={lead}
				actions={<LandingPrimaryCtaButton render={<Link href={trialHref} />} />}
			/>

			<MarketingSection eyebrow="Coverage" title={coverageTitle} lead={coverageBody}>
				<MarketingTrustBullets
					items={[
						"Adaptive practice on chapters your school is teaching this term",
						"Explain and Solve-with-me tutor included in the free trial",
						"Parent dashboard with chapter-level mastery radar chart",
					]}
				/>
			</MarketingSection>

			<MarketingSection
				eyebrow="Example chapters"
				title="Illustrative weak chapters parents often see"
				lead="These are examples only. Your child's list comes from their actual practice."
			>
				<ul
					className={cn(
						"mx-auto flex flex-wrap justify-center gap-2",
						MARKETING_SECTION_LEAD_MAX_CLASSNAME,
					)}
				>
					{exampleChapters.map((chapter) => (
						<li
							key={chapter}
							className="border-border/60 bg-muted/20 rounded-full border px-3 py-1.5 text-sm text-foreground"
						>
							{chapter}
						</li>
					))}
				</ul>
			</MarketingSection>

			<MarketingSection title={mapTitle} lead={mapBody} centered={false}>
				<p
					className={cn(
						"text-muted-foreground text-pretty text-base leading-relaxed",
						MARKETING_SECTION_LEAD_MAX_CLASSNAME,
					)}
				>
					Question wording, mark distribution, and chapter sequencing follow your board&apos;s school
					books. 24Vertex does not ask your child to study a parallel syllabus.
				</p>
			</MarketingSection>

			<MarketingSection eyebrow="FAQ" title="Common questions">
				<MarketingFaqAccordion items={faq} />
			</MarketingSection>

			{relatedLinks.length > 0 ? (
				<MarketingSection eyebrow="Explore" title="Related pages" centered>
					<ul className="flex flex-wrap justify-center gap-3">
						{relatedLinks.map((link) => (
							<li key={link.href}>
								<Link
									href={link.href}
									className="text-link rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium hover:underline"
								>
									{link.label}
								</Link>
							</li>
						))}
					</ul>
				</MarketingSection>
			) : null}

			<MarketingCtaBand
				title="Start with a free trial on your child's actual chapters"
				lead={LANDING_TRIAL_LEAD_FULL}
				actions={<LandingPrimaryCtaButton render={<Link href={trialHref} />} />}
			/>
		</>
	);
}
