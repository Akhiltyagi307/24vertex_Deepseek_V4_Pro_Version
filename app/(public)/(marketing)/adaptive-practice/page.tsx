import Link from "next/link";

import { LandingPracticePreview } from "@/components/marketing/landing-practice-preview";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import {
	LandingStudentFeatureCtaActions,
	LandingStudentFeatureHeroCtaBlock,
} from "@/components/marketing/landing-student-feature-cta";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import {
	LANDING_TRIAL_BODY_DETAIL,
	LANDING_TRIAL_LEAD_FULL,
	MARKETING_NAV,
} from "@/lib/marketing/landing-copy";
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
	"Warm up on a chapter you already know, so the brain is loose.",
	"Probe questions on amber chapters, where the actual gap is.",
	"Get an easier variant the moment you miss two in a row.",
	"Short recap, then the radar updates for tonight's check-in.",
] as const;

export default function AdaptivePracticePage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Adaptive practice"
				title="20 minutes on the 3 to 5 chapters that actually matter this week."
				lead="Not a 600-question bank. The set follows the chapters your school is teaching and the gaps your radar chart shows. You leave the screen with the next thing to do, not a guilt list."
				actions={<LandingStudentFeatureHeroCtaBlock />}
			/>

			<LandingPracticePreview />

			<MarketingSection
				eyebrow="A session"
				title="What 20 minutes actually does."
				pad="default"
				surface="muted"
			>
				<ol className="mx-auto grid max-w-2xl gap-3">
					{SESSION_STEPS.map((step, i) => (
						<li
							key={step}
							className={cn(
								"flex gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm medium:text-base",
								featureBentoCardSurfaceClassName,
							)}
						>
							<span className="text-[var(--link)] dark:text-[var(--subject-grid-icon)] font-semibold tabular-nums">
								{i + 1}.
							</span>
							<span className="text-foreground text-pretty">{step}</span>
						</li>
					))}
				</ol>
			</MarketingSection>

			<MarketingSection
				eyebrow="Board alignment"
				title="Practises the chapter you actually have, not a generic version of it."
				pad="tight"
			>
				<p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-muted-foreground medium:text-[17px]">
					Questions use NCERT-style chapter naming for{" "}
					<Link href="/boards/cbse" className="text-link font-medium hover:underline">
						CBSE
					</Link>
					, ICSE depth where applicable, and the major state board variants. So &ldquo;Triangles&rdquo; on your screen is the same Triangles your teacher wrote on the board this week.
				</p>
			</MarketingSection>

			<MarketingSection
				eyebrow="For parents reading this over the shoulder"
				title="What you are about to pay for, in one paragraph."
				pad="tight"
			>
				<div
					className={cn(
						"mx-auto max-w-3xl rounded-2xl border bg-card/60 px-5 py-5 text-[15px] leading-relaxed text-card-foreground medium:px-7 medium:py-6 medium:text-base",
						featureBentoCardSurfaceClassName,
					)}
				>
					<p className="text-pretty">{LANDING_TRIAL_BODY_DETAIL}</p>
					<p className="mt-3 text-pretty text-sm text-muted-foreground medium:text-[15px]">
						See full pricing on the{" "}
						<Link href={MARKETING_NAV.pricing.href} className="text-link font-medium hover:underline">
							pricing page
						</Link>
						, or the chapter-level dashboard you would see on{" "}
						<Link href={MARKETING_NAV.parentDashboard.href} className="text-link font-medium hover:underline">
							parent dashboard
						</Link>
						.
					</p>
				</div>
			</MarketingSection>

			<MarketingCtaBand
				title="Run the first targeted set this weekend."
				lead={LANDING_TRIAL_LEAD_FULL}
				actions={<LandingStudentFeatureCtaActions visual="on-committed" />}
				tone="committed"
			/>
		</MarketingSubpageShell>
	);
}
