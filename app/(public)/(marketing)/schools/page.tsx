import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingFaqAccordion } from "@/components/marketing/blocks/marketing-faq-accordion";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingProofStrip } from "@/components/marketing/blocks/marketing-proof-strip";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { Button } from "@/components/ui/button";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import {
	LANDING_ROLE_SIGNUP_HREF,
	LANDING_SCHOOLS_CTA_LABEL,
	MARKETING_SCHOOL_DEMO_CTA_HREF,
	MARKETING_SCHOOL_DEMO_CTA_LABEL,
} from "@/lib/marketing/landing-copy";
import { HELP_FAQ_CATEGORIES } from "@/lib/marketing/pages/help-faq";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";

export const metadata = marketingPageMetadata({
	title: "For schools",
	description:
		"Section-level chapter analytics, assignments, and teacher workspaces for Indian schools and coaching centres. Grades 6 to 10.",
	path: "/schools",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const ROLLOUT_STEPS = [
	{ step: "01", title: "Create your workspace", body: "Set your school or centre name and academic context." },
	{ step: "02", title: "Invite teachers", body: "Teachers join through approval so only your staff get access." },
	{ step: "03", title: "Run one assignment cycle", body: "See who attempted practice and which chapters need re-teaching." },
	{ step: "04", title: "Optional parent linking", body: "Families can link later without losing student progress." },
] as const;

const SCHOOL_FAQ = HELP_FAQ_CATEGORIES.find((c) => c.id === "schools")?.items ?? [];

export default function SchoolsPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="For schools"
				title="See which chapters your whole class is missing, before the unit test."
				lead="Section-level analytics, assignment flow, and the same chapter signals parents see, tuned for the teacher who wants to act on a class."
				actions={
					<>
						<Button
							className="h-11 rounded-full bg-[var(--subject-grid-icon)] px-5 font-semibold text-white"
							render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
						>
							{MARKETING_SCHOOL_DEMO_CTA_LABEL}
						</Button>
						<Button
							variant="outline"
							className="h-11 rounded-full"
							render={<Link href={LANDING_ROLE_SIGNUP_HREF} />}
						>
							{LANDING_SCHOOLS_CTA_LABEL}
						</Button>
					</>
				}
			/>

			<MarketingSection eyebrow="Teacher view" title="What your staff sees">
				<MarketingProofStrip
					src="/marketing/teacher-portal-dashboard.png"
					alt="24Vertex teacher dashboard showing class chapter mastery"
					caption="Illustrative teacher dashboard: chapter mastery across a section."
				/>
			</MarketingSection>

			<MarketingSection title="Rollout in four steps">
				<ol className="grid gap-4 medium:grid-cols-2">
					{ROLLOUT_STEPS.map((item) => (
						<li key={item.step} className={cn("space-y-2 px-5 py-5", featureBentoCardSurfaceClassName)}>
							<p className="text-link text-xs font-semibold tabular-nums">{item.step}</p>
							<h3 className="font-semibold text-foreground">{item.title}</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
						</li>
					))}
				</ol>
			</MarketingSection>

			<MarketingSection title="Pricing for schools" lead="Per-seat or school-wide plans. Talk to us for a pilot quote. No self-serve school checkout yet.">
				<p className="text-muted-foreground mx-auto max-w-2xl text-center text-sm">
					Coaching centres with multiple batches use the same workspace model.
				</p>
			</MarketingSection>

			<MarketingSection eyebrow="FAQ" title="School questions">
				<MarketingFaqAccordion items={SCHOOL_FAQ} idPrefix="schools" />
			</MarketingSection>

			<MarketingCtaBand
				title="Book a walkthrough with your academic lead"
				lead="20 minutes to map your sections, boards, and first assignment."
				actions={
					<Button
						className="h-11 rounded-full font-semibold"
						render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
					>
						{MARKETING_SCHOOL_DEMO_CTA_LABEL}
					</Button>
				}
			/>
		</MarketingSubpageShell>
	);
}
