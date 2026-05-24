import Link from "next/link";
import { BarChart3, ClipboardList, ShieldCheck } from "lucide-react";

import { MarketingAudiencePillars } from "@/components/marketing/blocks/marketing-audience-pillars";
import type { AudiencePillar } from "@/components/marketing/blocks/marketing-audience-pillars";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingFaqAccordion } from "@/components/marketing/blocks/marketing-faq-accordion";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingProofStrip } from "@/components/marketing/blocks/marketing-proof-strip";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingTrustBullets } from "@/components/marketing/blocks/marketing-trust-bullets";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { Button } from "@/components/ui/button";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import {
	LANDING_ROLE_SIGNUP_HREF,
	LANDING_SCHOOL_DEMO_CTA_BUTTON_CLASSNAME,
	LANDING_SCHOOL_SECONDARY_CTA_BUTTON_CLASSNAME,
	LANDING_SCHOOLS_CTA_LABEL,
	MARKETING_NAV,
	MARKETING_SCHOOL_DEMO_CTA_HREF,
	MARKETING_SCHOOL_DEMO_CTA_LABEL,
} from "@/lib/marketing/landing-copy";
import { HELP_FAQ_CATEGORIES } from "@/lib/marketing/pages/help-faq";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";

export const metadata = marketingPageMetadata({
	title: "Per-student intelligence. Section-wide scores.",
	description:
		"Per-student chapter intelligence, targeted assignments, and teacher workspaces that lift every section's marks. Indian schools and coaching centres, grades 6 to 10, CBSE, ICSE, and state boards.",
	path: "/schools",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const INSTITUTION_PILLARS: AudiencePillar[] = [
	{
		icon: BarChart3,
		step: "01",
		title: "Chapter mastery across every section",
		body: "See which chapters a class is missing before the unit test, not after papers are graded and the syllabus has moved on.",
		bullets: [
			"Section and grade views for coordinators",
			"Same radar chart families and teachers share",
			"Refreshed after every practice attempt",
		],
	},
	{
		icon: ClipboardList,
		step: "02",
		title: "Assignments that target weak chapters",
		body: "Teachers mark weak topics after a test and push a practice set to the students who need it, without re-teaching the whole unit.",
		bullets: [
			"Attempt tracking before the next period",
			"Separate batches for CBSE, ICSE, and state boards",
			"Coaching centres run multiple sections in one workspace",
		],
	},
	{
		icon: ShieldCheck,
		step: "03",
		title: "Privacy built for classrooms",
		body: "Staff see practice activity and mastery. Tutor chat stays with the student, the way doubt should work.",
		bullets: [
			"No ads in the product",
			"Student data is not sold",
			"Teacher approval before staff access",
		],
	},
];

const ROLLOUT_STEPS = [
	{ step: "01", title: "Create your workspace", body: "Set your school or centre name and academic context." },
	{ step: "02", title: "Invite teachers", body: "Teachers join through approval so only your staff get access." },
	{ step: "03", title: "Run one assignment cycle", body: "See who attempted practice and which chapters need re-teaching." },
	{ step: "04", title: "Optional parent linking", body: "Families can link later without losing student progress." },
] as const;

const STAFF_CAN_ACT_ON = [
	"Practice attempts and chapter mastery for your sections",
	"Assignment completion before the next class",
] as const;

const STAYS_PRIVATE = [
	"Tutor chat message text (student only)",
	"Other teachers' classes unless your admin grants access",
	"Parent billing details",
] as const;

const SCHOOL_FAQ =
	HELP_FAQ_CATEGORIES.find((c) => c.id === "schools")?.items.slice(0, 8) ?? [];

const proseClassName =
	"text-muted-foreground mx-auto max-w-7xl space-y-4 text-center text-pretty text-base leading-relaxed medium:text-lg";

export default function SchoolsPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="For schools & centres"
				title="The intelligence teachers need. The scores parents are waiting for."
				lead="For principals, academic coordinators, and coaching-centre owners. Per-student chapter intelligence, targeted assignments, and teacher workspaces that lift every section's marks. Grades 6 to 10, CBSE, ICSE, and state boards."
				actions={
					<>
						<Button
							className={LANDING_SCHOOL_DEMO_CTA_BUTTON_CLASSNAME}
							render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
						>
							{MARKETING_SCHOOL_DEMO_CTA_LABEL}
						</Button>
						<Button
							variant="outline"
							className={LANDING_SCHOOL_SECONDARY_CTA_BUTTON_CLASSNAME}
							render={<Link href={LANDING_ROLE_SIGNUP_HREF} />}
						>
							{LANDING_SCHOOLS_CTA_LABEL}
						</Button>
					</>
				}
			/>

			<MarketingSection eyebrow="Monday morning" title="What changes when chapter data is shared">
				<div className={proseClassName}>
					<p>
						Class 9 Section B sat the electricity unit test on Friday. Three chapters caused most of the
						lost marks. On Monday the subject teacher assigns a 15-question practice set on those chapters
						only. Before Thursday&apos;s period, the dashboard shows who attempted and who needs a nudge.
					</p>
					<p>
						Parents see the same chapter signal at home. You are not adding another silo. You are aligning
						classroom, home, and remediation on one map.
					</p>
				</div>
			</MarketingSection>

			<MarketingSection
				eyebrow="Platform"
				title="Built for how Indian schools actually run"
				lead="Analytics, assignments, and privacy defaults that respect both staff oversight and student dignity."
			>
				<MarketingAudiencePillars pillars={INSTITUTION_PILLARS} />
			</MarketingSection>

			<MarketingSection eyebrow="Teacher view" title="What your staff sees">
				<MarketingProofStrip
					src="/marketing/teacher-portal-dashboard.png"
					alt="24Vertex teacher dashboard showing class chapter mastery"
					caption="Illustrative teacher dashboard: chapter mastery across a section."
				/>
			</MarketingSection>

			<MarketingSection
				id="for-teachers"
				eyebrow="For teachers"
				title="A Tuesday after the class test"
				className="scroll-mt-28"
			>
				<div className={proseClassName}>
					<p>
						You graded 40 papers. Three chapters caused most of the lost marks. Instead of re-teaching
						everything, you assign targeted practice on those chapters only. Before the next period you see
						who attempted and who needs a nudge.
					</p>
					<p>
						Run separate sections for Class 8 CBSE morning and Class 9 state board evening without mixing
						analytics.{" "}
						<Link
							href={MARKETING_NAV.assignments.href}
							className="text-link font-medium underline-offset-4 hover:underline"
						>
							See the assignment workflow
						</Link>
						. Tutor chat stays private to the student.
					</p>
				</div>
			</MarketingSection>

			<MarketingSection
				eyebrow="Rollout"
				title="Four steps to your first assignment cycle"
				lead="Most pilots start with one section. Expand when teachers trust the rhythm."
			>
				<ol className="grid gap-4 medium:grid-cols-2">
					{ROLLOUT_STEPS.map((item) => (
						<li
							key={item.step}
							className={cn("space-y-2 px-5 py-5", landingFeatureBentoShell)}
						>
							<p className="text-link text-xs font-semibold tabular-nums">{item.step}</p>
							<h3 className="font-semibold text-foreground">{item.title}</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
						</li>
					))}
				</ol>
			</MarketingSection>

			<MarketingSection
				eyebrow="Governance"
				title="What staff do and do not see"
				lead="Clear boundaries so teachers can act on data without crossing into private doubt chat."
			>
				<div className="grid gap-8 medium:grid-cols-2 medium:gap-10">
					<div className="space-y-4">
						<h3 className="text-foreground text-center text-sm font-semibold tracking-tight medium:text-left medium:text-base">
							Staff act on
						</h3>
						<MarketingTrustBullets items={[...STAFF_CAN_ACT_ON]} tone="positive" />
					</div>
					<div className="space-y-4">
						<h3 className="text-foreground text-center text-sm font-semibold tracking-tight medium:text-left medium:text-base">
							Stays private
						</h3>
						<MarketingTrustBullets items={[...STAYS_PRIVATE]} tone="negative" />
					</div>
				</div>
			</MarketingSection>

			<MarketingSection
				eyebrow="Pilot"
				title="Start with one section, expand when the cycle works"
				lead="Per-seat or school-wide plans. Talk to us for a pilot quote. No self-serve school checkout yet."
			>
				<div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
					<p className="text-muted-foreground text-pretty text-base leading-relaxed medium:text-lg">
						Most schools pilot with one grade or section, invite teachers, run one assignment cycle, then
						expand. Coaching centres with multiple batches use the same workspace model.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3 medium:gap-4">
						<Button
							className={LANDING_SCHOOL_DEMO_CTA_BUTTON_CLASSNAME}
							render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
						>
							{MARKETING_SCHOOL_DEMO_CTA_LABEL}
						</Button>
						<Button
							variant="outline"
							className={LANDING_SCHOOL_SECONDARY_CTA_BUTTON_CLASSNAME}
							render={<Link href={LANDING_ROLE_SIGNUP_HREF} />}
						>
							{LANDING_SCHOOLS_CTA_LABEL}
						</Button>
					</div>
				</div>
			</MarketingSection>

			<MarketingSection eyebrow="FAQ" title="Questions schools ask before a pilot">
				<MarketingFaqAccordion items={SCHOOL_FAQ} idPrefix="schools" />
				<p className="text-muted-foreground mt-6 text-center text-sm">
					<Link
						href={MARKETING_NAV.help.href}
						className="text-link font-medium underline-offset-4 hover:underline"
					>
						See all questions in Help
					</Link>
				</p>
			</MarketingSection>

			<MarketingCtaBand
				title="Book a walkthrough with your academic lead"
				lead="20 minutes to map your sections, boards, and first assignment."
				actions={
					<>
						<Button
							className={LANDING_SCHOOL_DEMO_CTA_BUTTON_CLASSNAME}
							render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
						>
							{MARKETING_SCHOOL_DEMO_CTA_LABEL}
						</Button>
						<Button
							variant="outline"
							className={LANDING_SCHOOL_SECONDARY_CTA_BUTTON_CLASSNAME}
							render={<Link href={LANDING_ROLE_SIGNUP_HREF} />}
						>
							{LANDING_SCHOOLS_CTA_LABEL}
						</Button>
					</>
				}
			/>
		</MarketingSubpageShell>
	);
}
