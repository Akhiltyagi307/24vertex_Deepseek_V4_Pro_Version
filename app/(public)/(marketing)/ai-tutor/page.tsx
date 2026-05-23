import Link from "next/link";

import { LandingTutorModes } from "@/components/marketing/landing-tutor-modes";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { LANDING_PARENT_PRIMARY_CTA_HREF, MARKETING_NAV } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";

export const metadata = marketingPageMetadata({
	title: "AI tutor",
	description:
		"Explain and Solve-with-me modes: a private AI tutor for grades 6 to 10 that coaches through doubts without shaming wrong answers.",
	path: "/ai-tutor",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const MODE_GUIDE = [
	{
		title: "Use Explain when",
		body: "The chapter is theory-heavy: definitions, diagrams, history, biology concepts. Your child needs the idea in plain language first.",
	},
	{
		title: "Use Solve-with-me when",
		body: "The chapter is numerical: algebra steps, physics sums, geometry proofs. Your child wants to be coached, not handed the final line.",
	},
] as const;

export default function AiTutorPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="AI tutor"
				title="Two modes: Explain and Solve-with-me."
				lead="The same names your child sees in the app. Built for the doubts they would not raise in class or in front of the tuition teacher."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>

			<LandingTutorModes />

			<MarketingSection title="Which mode to pick">
				<div className="grid gap-4 medium:grid-cols-2">
					{MODE_GUIDE.map((item) => (
						<div key={item.title} className={cn("px-5 py-5", featureBentoCardSurfaceClassName)}>
							<h3 className="font-semibold text-foreground">{item.title}</h3>
							<p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.body}</p>
						</div>
					))}
				</div>
			</MarketingSection>

			<MarketingSection title="Safety and honesty">
				<ul className="text-muted-foreground mx-auto max-w-2xl list-disc space-y-2 pl-5 text-base leading-relaxed">
					<li>Wrong answers get another explanation, not ridicule.</li>
					<li>Solve-with-me scaffolds steps; it does not dump full solutions on the first message.</li>
					<li>Included in the 14-day free trial.</li>
					<li>
						Tutor chat visibility: see our{" "}
						<Link href={`${MARKETING_NAV.security.href}#tutor-chat`} className="text-link hover:underline">
							security page
						</Link>
						.
					</li>
				</ul>
			</MarketingSection>

			<MarketingCtaBand
				title="Let your child ask the doubt they have been avoiding"
				lead="14 days free. Tutor included. No card needed."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>
		</MarketingSubpageShell>
	);
}
