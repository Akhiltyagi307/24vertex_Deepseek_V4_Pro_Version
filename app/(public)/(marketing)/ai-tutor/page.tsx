import Link from "next/link";
import { Check } from "lucide-react";

import { LandingTutorModes } from "@/components/marketing/landing-tutor-modes";
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
	title: "AI tutor",
	description:
		"Explain and Solve-with-me modes: a private AI tutor for grades 6 to 10 that coaches through doubts without shaming wrong answers.",
	path: "/ai-tutor",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const PROMISES = [
	"Wrong answers get another explanation, not a sigh.",
	"Solve-with-me coaches the step. It does not dump the full solution on the first message.",
	"Knows your textbook: NCERT and ICSE chapter structures, with state board variants.",
] as const;

export default function AiTutorPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="AI tutor"
				title="Ask the doubt you would not raise in class."
				lead="Two modes named the same way in the app: Explain when you need the idea broken down, Solve-with-me when you want to be coached through the steps. One tap to switch. Nobody else in your section ever sees the chat."
				actions={<LandingStudentFeatureHeroCtaBlock />}
			/>

			<LandingTutorModes />

			<MarketingSection
				eyebrow="The promise"
				title="Three things this tutor will not do."
				pad="default"
				surface="muted"
			>
				<ul className="mx-auto grid max-w-3xl gap-3">
					{PROMISES.map((promise) => (
						<li
							key={promise}
							className={cn(
								"flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-[15px] leading-relaxed text-card-foreground medium:px-5 medium:py-4 medium:text-base",
								featureBentoCardSurfaceClassName,
							)}
						>
							<span
								className="bg-[var(--subject-grid-icon)]/15 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
								aria-hidden
							>
								<Check className="size-3.5 text-[var(--link)] dark:text-[var(--subject-grid-icon)]" strokeWidth={2.5} />
							</span>
							<span className="text-pretty">{promise}</span>
						</li>
					))}
				</ul>
			</MarketingSection>

			<MarketingSection
				eyebrow="For parents reading this"
				title="What stays visible, what stays private."
				pad="tight"
			>
				<div
					className={cn(
						"mx-auto max-w-3xl rounded-2xl border bg-card/60 px-5 py-5 text-[15px] leading-relaxed text-card-foreground medium:px-7 medium:py-6 medium:text-base",
						featureBentoCardSurfaceClassName,
					)}
				>
					<p className="text-pretty">
						You and the linked teacher see <span className="font-semibold">what your child practised and how often</span>, and which chapters they asked about. You do not see the words they used to ask.
					</p>
					<p className="mt-3 text-pretty">{LANDING_TRIAL_BODY_DETAIL}</p>
					<p className="mt-3 text-pretty text-sm text-muted-foreground medium:text-[15px]">
						Full visibility rules are on the{" "}
						<Link
							href={`${MARKETING_NAV.security.href}#tutor-chat`}
							className="text-link font-medium hover:underline"
						>
							security page
						</Link>
						.
					</p>
				</div>
			</MarketingSection>

			<MarketingCtaBand
				title="Ask the doubt you have been avoiding tonight."
				lead={LANDING_TRIAL_LEAD_FULL}
				actions={<LandingStudentFeatureCtaActions visual="on-committed" />}
				tone="committed"
			/>
		</MarketingSubpageShell>
	);
}
