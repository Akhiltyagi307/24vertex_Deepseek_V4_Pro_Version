import Link from "next/link";

import { LandingAssignmentsPreview } from "@/components/marketing/landing-assignments-preview";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingFeatureSpotlight } from "@/components/marketing/blocks/marketing-feature-spotlight";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { Button } from "@/components/ui/button";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import {
	LANDING_SCHOOL_DEMO_CTA_BUTTON_CLASSNAME,
	LANDING_SCHOOL_CTA_LEAD,
	LANDING_SCHOOLS_CTA_LABEL,
	MARKETING_SCHOOL_DEMO_CTA_HREF,
	MARKETING_SCHOOL_DEMO_CTA_LABEL,
} from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

export const metadata = marketingPageMetadata({
	title: "Teacher assignments",
	description:
		"Mark weak chapters after a class test and push targeted practice to your section. See who attempted before the next period.",
	path: "/assignments",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const WORKFLOW = [
	"Grade the test and note which chapters cost the most marks.",
	"Mark those chapters weak for the section in the teacher dashboard.",
	"Push a practice set sized for one homework window (about 15 questions).",
	"Check attempt status before the next class and nudge students who have not started.",
] as const;

export default function AssignmentsPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Teacher assignments"
				title="Targeted practice, not a blanket &ldquo;revise Chapter 4.&rdquo;"
				lead="After a class test, assign practice on the chapters that actually caused lost marks. See who attempted before the next period."
				actions={
					<Button
						className={LANDING_SCHOOL_DEMO_CTA_BUTTON_CLASSNAME}
						render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
					>
						{MARKETING_SCHOOL_DEMO_CTA_LABEL}
					</Button>
				}
			/>

			<LandingAssignmentsPreview />

			<MarketingSection
				eyebrow="Workflow"
				title="Four steps after a class test."
				pad="default"
				surface="muted"
			>
				<ol className="mx-auto grid max-w-2xl gap-3">
					{WORKFLOW.map((step, i) => (
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

			<MarketingSection pad="tight">
				<MarketingFeatureSpotlight
					icon={ClipboardList}
					title="The data your next lesson plan would have to guess at."
					body="Per-student attempt status on the exact chapters you flagged. So the next class starts with a list of three students to call on, not assumptions about what the section understood."
				/>
			</MarketingSection>

			<MarketingCtaBand
				title="Run one assignment cycle with one section. See it for yourself."
				lead={LANDING_SCHOOL_CTA_LEAD}
				actions={
					<>
						<Button
							className="h-11 rounded-full bg-white px-6 text-sm font-semibold text-[#1f7350] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] transition-colors duration-200 ease-out hover:bg-white/95 hover:text-[#1a5e44]"
							render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
						>
							{MARKETING_SCHOOL_DEMO_CTA_LABEL}
						</Button>
						<Button
							variant="outline"
							className="h-11 rounded-full border-white/50 bg-white/10 px-5 text-sm font-semibold text-white shadow-none transition-colors duration-200 ease-out hover:bg-white/20 hover:text-white"
							render={<Link href="/schools" />}
						>
							{LANDING_SCHOOLS_CTA_LABEL}
						</Button>
					</>
				}
				tone="committed"
			/>
		</MarketingSubpageShell>
	);
}
