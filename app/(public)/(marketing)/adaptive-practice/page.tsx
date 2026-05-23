import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingProofStrip } from "@/components/marketing/blocks/marketing-proof-strip";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { LANDING_PARENT_PRIMARY_CTA_HREF, MARKETING_NAV } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";

export const metadata = marketingPageMetadata({
	title: "Adaptive practice",
	description:
		"20-minute practice on the 3 to 5 weak chapters that matter this week. Aligned to CBSE, ICSE, and state boards for grades 6 to 10.",
	path: "/adaptive-practice",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const SESSION_STEPS = [
	"Warm-up on a chapter your child already knows (confidence)",
	"Probe questions on amber chapters (find the real gap)",
	"Remediate with easier variants when they miss",
	"Short recap so the heatmap updates for you",
] as const;

export default function AdaptivePracticePage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Adaptive practice"
				title="20 minutes on the 3 to 5 chapters that matter this week."
				lead="Not a 600-question bank. Practice follows the chapters your child's school is teaching and the gaps their heatmap shows."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>

			<MarketingSection title="How weak chapters are picked">
				<p className="text-muted-foreground mx-auto max-w-2xl text-pretty text-center text-base leading-relaxed">
					Diagnostics and ongoing attempts update chapter mastery. The system surfaces a small set to
					focus on, so your child is not overwhelmed.
				</p>
			</MarketingSection>

			<MarketingSection eyebrow="A session" title="What 20 minutes looks like">
				<ol className="mx-auto grid max-w-xl gap-3">
					{SESSION_STEPS.map((step, i) => (
						<li
							key={step}
							className={cn("flex gap-3 px-4 py-3 text-sm medium:text-base", featureBentoCardSurfaceClassName)}
						>
							<span className="text-link font-semibold tabular-nums">{i + 1}.</span>
							<span className="text-foreground">{step}</span>
						</li>
					))}
				</ol>
			</MarketingSection>

			<MarketingSection title="Board-aligned chapters">
				<p className="text-muted-foreground mx-auto max-w-2xl text-center text-base leading-relaxed">
					Questions use NCERT-style chapter naming for{" "}
					<Link href="/boards/cbse" className="text-link font-medium hover:underline">
						CBSE
					</Link>
					, ICSE depth where applicable, and major state board variants.
				</p>
			</MarketingSection>

			<MarketingSection title="Student experience">
				<MarketingProofStrip
					src="/marketing/student-portal-dashboard.png"
					alt="24Vertex student dashboard with practice and chapters"
					caption="Student view: practice entry and chapter context."
				/>
			</MarketingSection>

			<MarketingSection title="Free trial">
				<p className="text-muted-foreground text-center text-base">
					5 practice tests in the 14-day trial.{" "}
					<Link href={MARKETING_NAV.pricing.href} className="text-link font-medium hover:underline">
						See pricing
					</Link>
					.
				</p>
			</MarketingSection>

			<MarketingCtaBand
				title="Run the first targeted practice this weekend"
				lead="14 days free. No card needed."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
			/>
		</MarketingSubpageShell>
	);
}
