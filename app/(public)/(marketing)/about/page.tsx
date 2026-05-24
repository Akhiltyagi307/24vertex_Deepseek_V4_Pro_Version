import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingTrustBullets } from "@/components/marketing/blocks/marketing-trust-bullets";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import {
	LANDING_PARENT_PRIMARY_CTA_HREF,
	LANDING_TRIAL_LEAD_FULL,
	MARKETING_NAV,
} from "@/lib/marketing/landing-copy";
import {
	ABOUT_BELIEFS,
	ABOUT_HERO,
	ABOUT_ORIGIN_BEATS,
	ABOUT_TEAM,
	ABOUT_WILL_NOT,
} from "@/lib/marketing/pages/about";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";

export const metadata = marketingPageMetadata({
	title: "About",
	description: ABOUT_HERO.lead,
	path: "/about",
});

export const dynamic = "force-static";
export const revalidate = 86400;

export default function AboutPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow={ABOUT_HERO.eyebrow}
				title={ABOUT_HERO.title}
				lead={ABOUT_HERO.lead}
			/>

			<MarketingSection eyebrow="Our story" title="Why 24Vertex exists">
				<ol className="mx-auto grid max-w-3xl gap-6">
					{ABOUT_ORIGIN_BEATS.map((beat, i) => (
						<li
							key={beat.title}
							className={cn("space-y-2 px-5 py-5 medium:px-6", featureBentoCardSurfaceClassName)}
						>
							<p className="text-link text-xs font-semibold tabular-nums">0{i + 1}</p>
							<h3 className="text-lg font-semibold tracking-tight text-foreground">{beat.title}</h3>
							<p className="text-muted-foreground text-pretty text-sm leading-relaxed medium:text-base">
								{beat.body}
							</p>
						</li>
					))}
				</ol>
			</MarketingSection>

			<MarketingSection eyebrow="Beliefs" title="What we build for">
				<div className="grid gap-4 medium:grid-cols-2">
					{ABOUT_BELIEFS.map((card) => (
						<div key={card.title} className={cn("space-y-2 px-5 py-5", featureBentoCardSurfaceClassName)}>
							<h3 className="font-semibold text-foreground">{card.title}</h3>
							<p className="text-muted-foreground text-pretty text-sm leading-relaxed">{card.body}</p>
						</div>
					))}
				</div>
			</MarketingSection>

			<MarketingSection eyebrow="Lines we do not cross" title="What we will not do">
				<MarketingTrustBullets items={[...ABOUT_WILL_NOT]} />
			</MarketingSection>

			<MarketingSection eyebrow="Team" title="The people behind the product">
				<div className="grid gap-4 medium:grid-cols-2">
					{ABOUT_TEAM.map((member) => (
						<div
							key={member.name}
							className={cn("flex gap-4 px-5 py-5", featureBentoCardSurfaceClassName)}
						>
							<div
								className="bg-primary/15 text-link flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
								aria-hidden
							>
								{member.initials}
							</div>
							<div>
								<h3 className="font-semibold text-foreground">{member.name}</h3>
								<p className="text-muted-foreground text-sm">{member.role}</p>
								<p className="text-muted-foreground mt-2 text-pretty text-sm leading-relaxed">
									{member.bio}
								</p>
							</div>
						</div>
					))}
				</div>
			</MarketingSection>

			<MarketingCtaBand
				title="See the product on your child's chapters"
				lead={LANDING_TRIAL_LEAD_FULL}
				actions={
					<>
						<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />
						<Link
							href={MARKETING_NAV.schools.href}
							className="text-link text-sm font-medium underline-offset-4 hover:underline"
						>
							Bringing 24Vertex to a school?
						</Link>
					</>
				}
			/>
		</MarketingSubpageShell>
	);
}
