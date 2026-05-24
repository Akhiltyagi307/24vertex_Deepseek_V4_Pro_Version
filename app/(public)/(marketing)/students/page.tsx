import Link from "next/link";
import { BarChart3, BrainCircuit, MessageCircleQuestion } from "lucide-react";

import { MarketingAudiencePillars } from "@/components/marketing/blocks/marketing-audience-pillars";
import type { AudiencePillar } from "@/components/marketing/blocks/marketing-audience-pillars";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingFaqAccordion } from "@/components/marketing/blocks/marketing-faq-accordion";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingProofStrip } from "@/components/marketing/blocks/marketing-proof-strip";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { LandingStudentStakesSection } from "@/components/marketing/landing-student-stakes-section";
import { LandingTutorModes } from "@/components/marketing/landing-tutor-modes";
import { Button } from "@/components/ui/button";
import {
	LANDING_PARENT_PRIMARY_CTA_HREF,
	LANDING_STUDENT_PRIMARY_CTA_HREF,
	LANDING_STUDENT_PRIMARY_CTA_LABEL,
	LANDING_STUDENT_SHARE_PARENT_CTA_LABEL,
	MARKETING_NAV,
} from "@/lib/marketing/landing-copy";
import { HELP_FAQ_CATEGORIES } from "@/lib/marketing/pages/help-faq";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { marketingSectionNarrativeClassName } from "@/lib/marketing/marketing-section-rhythm";

export const metadata = marketingPageMetadata({
	title: "Smarter preparation. Higher scores.",
	description:
		"Class 6 to 10 exam preparation powered by chapter-level intelligence. Adaptive practice on your actual textbook, a private AI tutor, and a radar chart that knows every weak chapter before the unit test. CBSE, ICSE, and state boards.",
	path: "/students",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const STUDENT_PILLARS: AudiencePillar[] = [
	{
		icon: BrainCircuit,
		step: "01",
		title: "Practice that follows your chapters",
		body: "Questions adapt to how you are doing on the topics your school is teaching this term, not a random internet syllabus.",
		bullets: [
			"CBSE, ICSE, and state boards",
			"Harder when you are ready, easier when you are stuck",
			"Five practice tests in the free trial (1 hour or 3 hours each)",
		],
	},
	{
		icon: BarChart3,
		step: "02",
		title: "A radar chart that tells you what to open tonight",
		body: "After each session you see which chapters are strong, weak, or guesswork on a subject radar chart. No more revising only what already feels easy.",
		bullets: [
			"Updated within minutes of practice",
			"Same chapter view your parent and teacher can see",
			"Plain language, not jargon",
		],
	},
	{
		icon: MessageCircleQuestion,
		step: "03",
		title: "A tutor that does not judge wrong answers",
		body: "Explain mode breaks a chapter down. Solve with me coaches you step by step without dumping the final answer on the first try.",
		bullets: [
			"Private chats: your class is not watching",
			"Available when tuition is over and doubts show up",
			"Built for how Indian boards ask questions",
		],
	},
];

const STUDENT_FAQ_PREVIEW = HELP_FAQ_CATEGORIES.find((c) => c.id === "students")?.items ?? [];

export default function StudentsPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="For students"
				title="The intelligence behind preparation. The proof in the scores."
				lead="Class 6 to 10 exam preparation that adapts to your actual textbook. A chapter mastery radar chart, a private AI tutor that closes every weak chapter, and the kind of practice that walks you into the unit test ready. CBSE, ICSE, and state boards."
				actions={
					<>
						<LandingPrimaryCtaButton
							label={LANDING_STUDENT_PRIMARY_CTA_LABEL}
							render={<Link href={LANDING_STUDENT_PRIMARY_CTA_HREF} />}
						/>
						<Button
							variant="outline"
							className="h-11 rounded-full"
							render={<Link href="/login" />}
						>
							Log in
						</Button>
					</>
				}
			/>

			<MarketingSection eyebrow="A Sunday after tuition" title="Twenty minutes on the right chapter">
				<div className={marketingSectionNarrativeClassName}>
					<p>
						Physics unit test is Thursday. You are fine on kinematics but shaky on electrostatics. You
						could re-read the whole unit, or you could open 24Vertex, see electrostatics in red, run a
						20-minute practice set, and ask the tutor why the sign on charge keeps flipping.
					</p>
					<p>
						By Wednesday the radar chart shifts. You did not study more hours. You studied the chapters that
						actually needed you.
					</p>
				</div>
			</MarketingSection>

			<LandingStudentStakesSection />

			<MarketingSection eyebrow="Your workspace" title="What you see after you log in">
				<MarketingProofStrip
					src="/marketing/student-portal-dashboard.png"
					alt="24Vertex student dashboard showing chapter mastery radar chart and practice shortcuts"
					caption="Illustrative student dashboard: chapter mastery and what to practice next."
				/>
			</MarketingSection>

			<MarketingSection
				eyebrow="How it helps"
				title="Three tools that work together"
				lead="Practice, visibility, and doubt support. Not three separate apps."
			>
				<MarketingAudiencePillars pillars={STUDENT_PILLARS} />
			</MarketingSection>

			<LandingTutorModes />

			<MarketingSection eyebrow="FAQ" title="Questions students ask before signing up">
				<MarketingFaqAccordion items={STUDENT_FAQ_PREVIEW} idPrefix="students" />
				<p className="text-muted-foreground mt-6 text-center text-sm">
					<Link href={MARKETING_NAV.help.href} className="text-link font-medium underline-offset-4 hover:underline">
						See all questions in Help
					</Link>
				</p>
			</MarketingSection>

			<MarketingSection eyebrow="Student subscription" title="Your parent starts the trial">
				<p className="text-muted-foreground mx-auto max-w-2xl text-center text-pretty text-base leading-relaxed medium:text-lg">
					Only student accounts are paid. Parent and teacher accounts are free. Your parent signs up
					for the 14-day trial and links your student account. You keep your progress if your school
					joins later.
				</p>
				<div className="mt-8 flex justify-center">
					<Button
						variant="outline"
						className="h-11 rounded-full"
						render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />}
					>
						{LANDING_STUDENT_SHARE_PARENT_CTA_LABEL}
					</Button>
				</div>
			</MarketingSection>

			<MarketingCtaBand
				title="Tonight, pick one red chapter and run a 20-minute set"
				lead="Free student account. Practice and tutor access when your parent links the paid student subscription."
				actions={
					<LandingPrimaryCtaButton
						label={LANDING_STUDENT_PRIMARY_CTA_LABEL}
						render={<Link href={LANDING_STUDENT_PRIMARY_CTA_HREF} />}
					/>
				}
			/>
		</MarketingSubpageShell>
	);
}
