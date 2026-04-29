import Link from "next/link";
import {
	BookOpenIcon,
	ChartColumnIcon,
	GraduationCapIcon,
	LayoutDashboardIcon,
	MessagesSquareIcon,
	UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPublicSupportEmail } from "@/lib/env";
import { LANDING_ROLE_SIGNUP_PRIMARY_CTA } from "@/lib/marketing/landing-copy";

const sectionShell = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8";
const sectionTitle = "text-3xl font-semibold tracking-tight text-foreground sm:text-4xl";
const sectionLead = "mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg";

const FEATURE_ITEMS = [
	{
		icon: BookOpenIcon,
		title: "Adaptive practice",
		body: "Tests and practice sessions that respect curriculum structure and lean on weak topics first.",
	},
	{
		icon: ChartColumnIcon,
		title: "Topic-level intelligence",
		body: "A live view of mastery across subjects so students know what to tackle next.",
	},
	{
		icon: MessagesSquareIcon,
		title: "Doubt and guidance",
		body: "AI-assisted help where the product exposes it, with clear boundaries for classroom use.",
	},
	{
		icon: LayoutDashboardIcon,
		title: "Assignments",
		body: "Teachers push work to the right grade and section; students see deadlines in one feed.",
	},
	{
		icon: UsersIcon,
		title: "Parent visibility",
		body: "Linked guardians see dashboards, reports, and notifications without editing student data.",
	},
	{
		icon: GraduationCapIcon,
		title: "Class monitoring",
		body: "Grade and section filters, class trends, and paths to drill into individual learners.",
	},
] as const;

function InlineRoleSignupLinks() {
	const linkClass = "font-medium text-primary underline-offset-4 hover:underline";
	return (
		<p className="text-sm text-muted-foreground">
			<span className="text-foreground/90">Prefer a direct link?</span>{" "}
			<Link href="/signup/student" className={linkClass}>
				Student
			</Link>
			<span aria-hidden className="text-muted-foreground/80">
				{" "}
				·{" "}
			</span>
			<Link href="/signup/parent" className={linkClass}>
				Parent
			</Link>
			<span aria-hidden className="text-muted-foreground/80">
				{" "}
				·{" "}
			</span>
			<Link href="/signup/teacher" className={linkClass}>
				Teacher
			</Link>
		</p>
	);
}

export function LandingMarketingBody() {
	const supportEmail = getPublicSupportEmail();

	return (
		<>
			<section
				id="home"
				className={`border-b border-border bg-gradient-to-b from-muted/35 to-background ${sectionShell} pb-20 pt-10 sm:pb-24 sm:pt-14`}
			>
				<div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-16">
					<div className="min-w-0 max-w-[75ch] space-y-6">
						<Badge variant="secondary" className="font-medium">
							Grades 6 to 12
						</Badge>
						<h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
							Adaptive practice and assessment for your whole school community
						</h1>
						<p className="text-pretty text-lg text-muted-foreground">
							EduAI connects students, parents, and teachers in one place: personalized tests, topic-level
							tracking, assignments, and notifications that keep everyone aligned without noise.
						</p>
						<div className="flex flex-wrap items-center gap-3">
							<Button size="lg" render={<Link href="/signup/role-picker" />}>
								{LANDING_ROLE_SIGNUP_PRIMARY_CTA}
							</Button>
							<Button size="lg" variant="outline" render={<Link href="/login" />}>
								Log in
							</Button>
						</div>
						<div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
							<p className="text-sm leading-relaxed text-muted-foreground">
								Use <span className="font-medium text-foreground">{LANDING_ROLE_SIGNUP_PRIMARY_CTA}</span>{" "}
								to open the role chooser. The timed trial is for{" "}
								<span className="font-medium text-foreground">new student accounts</span>; parents and
								teachers still start from the same signup flow, then land in the right portal.
							</p>
							<InlineRoleSignupLinks />
						</div>
					</div>
					<div className="relative min-h-[14rem] rounded-2xl border border-border bg-card p-6 shadow-sm ring-1 ring-foreground/5 sm:min-h-[16rem] lg:min-h-[18rem]">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">At a glance</p>
						<ul className="mt-5 space-y-4 text-sm">
							<li className="flex gap-3">
								<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 dark:bg-primary/25">
									<LayoutDashboardIcon className="size-4 text-subject-grid-icon" aria-hidden />
								</span>
								<span>
									<span className="font-medium text-foreground">Student portal:</span> practice, tests,
									performance tracker, assignments, doubt help.
								</span>
							</li>
							<li className="flex gap-3">
								<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
									<UsersIcon className="size-4 text-foreground" aria-hidden />
								</span>
								<span>
									<span className="font-medium text-foreground">Parent portal:</span> read-only view of
									your child&apos;s progress and school updates.
								</span>
							</li>
							<li className="flex gap-3">
								<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
									<GraduationCapIcon className="size-4 text-foreground" aria-hidden />
								</span>
								<span>
									<span className="font-medium text-foreground">Teacher tools:</span> assignments,
									monitoring, and notifications by grade and section.
								</span>
							</li>
						</ul>
					</div>
				</div>
			</section>

			<section id="features" className={`border-b border-border ${sectionShell}`}>
				<div className="max-w-3xl">
					<h2 className={sectionTitle}>Features</h2>
					<p className={sectionLead}>
						Built for how students study after school, how parents check in quickly, and how teachers run a
						class without juggling five tools.
					</p>
				</div>
				<Separator className="my-10" />
				<div className="mt-2 grid gap-6 lg:grid-cols-2">
					{FEATURE_ITEMS.slice(0, 2).map((row) => {
						const Icon = row.icon;
						return (
							<div
								key={row.title}
								className="rounded-2xl border border-border bg-muted/15 p-6 ring-1 ring-foreground/5 sm:p-8"
							>
								<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
									<span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
										<Icon className="size-6 text-foreground" aria-hidden />
									</span>
									<div className="min-w-0">
										<h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
											{row.title}
										</h3>
										<p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
											{row.body}
										</p>
									</div>
								</div>
							</div>
						);
					})}
				</div>
				<Separator className="my-12" />
				<div className="overflow-hidden rounded-xl border border-border bg-card/60">
					<ul className="divide-y divide-border">
						{FEATURE_ITEMS.slice(2).map((row) => {
							const Icon = row.icon;
							return (
								<li key={row.title} className="flex gap-4 px-4 py-5 sm:px-6 sm:py-5">
									<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
										<Icon className="size-4 text-foreground" aria-hidden />
									</span>
									<div className="min-w-0">
										<p className="font-semibold text-foreground">{row.title}</p>
										<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{row.body}</p>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			</section>

			<section id="benefits" className={`border-b border-border bg-muted/25 ${sectionShell}`}>
				<div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
					<div className="max-w-xl">
						<h2 className={sectionTitle}>Benefits</h2>
						<p className={sectionLead}>
							Clear roles, shared language across portals, and reporting everyone can trust.
						</p>
					</div>
					<ul className="max-w-prose space-y-6 text-base leading-relaxed text-muted-foreground">
						<li className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-x-4">
							<span className="font-semibold text-foreground">Students</span>
							<span>Less guesswork about what to revise; progress you can see after each session.</span>
						</li>
						<li className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-x-4">
							<span className="font-semibold text-foreground">Parents</span>
							<span>Fewer surprises at PTMs; a steady pulse on assignments and performance.</span>
						</li>
						<li className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-x-4">
							<span className="font-semibold text-foreground">Teachers</span>
							<span>One workflow for assigning, reminding, and spotting who needs support early.</span>
						</li>
						<li className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-x-4">
							<span className="font-semibold text-foreground">Schools</span>
							<span>
								Structured subjects and topics, with room for streams and electives in senior grades.
							</span>
						</li>
					</ul>
				</div>
			</section>

			<section id="how-it-works" className={`border-b border-border ${sectionShell}`}>
				<div className="max-w-3xl">
					<h2 className={sectionTitle}>How it works</h2>
					<p className={sectionLead}>
						One front door, then routing that matches the job you came to do.
					</p>
				</div>
				<ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
					{[
						{
							step: "1",
							title: "Choose a role",
							body: `Use ${LANDING_ROLE_SIGNUP_PRIMARY_CTA} in the header or above, or the direct student, parent, and teacher links in the hero when you already know your path.`,
						},
						{
							step: "2",
							title: "Complete your profile",
							body: "Answer the prompts the product needs (grade, section, parent link codes where applicable) so dashboards and assignments line up correctly.",
						},
						{
							step: "3",
							title: "Start in the right portal",
							body: "Students begin on the trial where eligible; everyone else lands in their portal with tasks surfaced first.",
						},
					].map((item) => (
						<li key={item.step} className="flex min-w-0 flex-col gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-foreground shadow-sm">
								{item.step}
							</span>
							<div>
								<p className="text-base font-semibold text-foreground">{item.title}</p>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
							</div>
						</li>
					))}
				</ol>
			</section>

			<section id="pricing" className={`border-b border-border ${sectionShell}`}>
				<div className="mx-auto max-w-xl text-center">
					<h2 className={sectionTitle}>Pricing</h2>
					<p className={`${sectionLead} mx-auto max-w-2xl`}>
						The trial window applies to qualifying student signups. Paid upgrades happen inside the app when
						you need higher limits.
					</p>
				</div>
				<div className="mx-auto mt-12 max-w-lg">
					<Card className="text-left">
						<CardHeader className="space-y-3">
							<div className="flex flex-wrap items-center gap-2">
								<CardTitle className="text-xl">Student free trial</CardTitle>
								<Badge variant="secondary">14-day</Badge>
							</div>
							<CardDescription>
								New student profiles can receive two weeks of access on the free tier, subject to the
								product&apos;s eligibility rules. Parents and teachers use the same signup door; they do
								not need a separate trial-only control. Student billing appears when a paid plan is
								needed for practice limits you outgrow.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3 text-sm text-muted-foreground">
							<p className="font-medium text-foreground">Included during the trial window</p>
							<ul className="list-inside list-disc space-y-1.5 marker:text-primary">
								<li>Guided signup for grade, section, and stream where applicable</li>
								<li>Practice and assignment surfaces for the student portal</li>
								<li>Upgrade path from the in-app subscription page when limits apply</li>
							</ul>
						</CardContent>
						<CardFooter className="flex flex-col gap-2 sm:flex-row">
							<Button className="w-full sm:flex-1" render={<Link href="/signup/role-picker" />}>
								{LANDING_ROLE_SIGNUP_PRIMARY_CTA}
							</Button>
							<Button variant="outline" className="w-full sm:flex-1" render={<Link href="/login" />}>
								Log in
							</Button>
						</CardFooter>
					</Card>
				</div>
			</section>

			<section id="voices" className={`${sectionShell} pb-24`}>
				<div className="max-w-3xl">
					<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-2">
						<h2 className={sectionTitle}>What we design for</h2>
						<Badge variant="outline" className="w-fit font-normal text-muted-foreground">
							Composite, not testimonials
						</Badge>
					</div>
					<p className={sectionLead}>
						Short narratives we pressure-test the product against. They are not quotes from paying customers.
					</p>
				</div>
				<div className="mt-12 grid gap-6 lg:grid-cols-2">
					<figure className="flex flex-col rounded-2xl border border-dashed border-border/80 bg-muted/15 p-7 lg:col-span-2 lg:p-8">
						<blockquote className="text-base leading-relaxed text-muted-foreground lg:text-lg">
							<p>
								My daughter finally has a single place for practice and school-assigned tests. The topic
								list makes it obvious what she is avoiding.
							</p>
						</blockquote>
						<figcaption className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Scenario: parent, grade 9
						</figcaption>
					</figure>
					<figure className="flex flex-col rounded-2xl border border-dashed border-border/80 bg-muted/10 p-6">
						<blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">
							<p>
								As a class teacher, I care about section-level assignments and nudges. EduAI keeps that
								structure explicit instead of mixing everyone into one bucket.
							</p>
						</blockquote>
						<figcaption className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Scenario: science teacher, grades 10 to 12
						</figcaption>
					</figure>
					<figure className="flex flex-col rounded-2xl border border-dashed border-border/80 bg-muted/10 p-6">
						<blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">
							<p>
								I use it on my phone between tuition blocks. Short sessions still show up in my tracker,
								which keeps me honest about revision.
							</p>
						</blockquote>
						<figcaption className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Scenario: student, grade 11
						</figcaption>
					</figure>
				</div>
			</section>

			<footer className="border-t border-border bg-muted/30">
				<div className={`${sectionShell} flex flex-col items-center gap-6 py-12 text-center`}>
					<div className="space-y-2">
						<p className="text-base font-medium text-foreground">Get started</p>
						<p className="max-w-md text-sm text-muted-foreground">
							Open the role chooser, or jump straight into the signup form that matches you.
						</p>
					</div>
					<div className="flex flex-wrap justify-center gap-3">
						<Button render={<Link href="/signup/role-picker" />}>{LANDING_ROLE_SIGNUP_PRIMARY_CTA}</Button>
						<Button variant="outline" render={<Link href="/login" />}>
							Log in
						</Button>
					</div>
					<nav
						aria-label="Signup shortcuts"
						className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm"
					>
						<Link
							href="/signup/student"
							className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
						>
							Student signup
						</Link>
						<span className="text-muted-foreground/50" aria-hidden>
							·
						</span>
						<Link
							href="/signup/parent"
							className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
						>
							Parent signup
						</Link>
						<span className="text-muted-foreground/50" aria-hidden>
							·
						</span>
						<Link
							href="/signup/teacher"
							className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
						>
							Teacher signup
						</Link>
					</nav>
					<Separator className="max-w-md" />
					<nav
						aria-label="Trust and legal"
						className="flex max-w-lg flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
					>
						{supportEmail ? (
							<a
								href={`mailto:${supportEmail}`}
								className="underline-offset-4 hover:text-foreground hover:underline"
							>
								Email support
							</a>
						) : (
							<Link href="/legal/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
								Contact via privacy page
							</Link>
						)}
						<span className="text-muted-foreground/40" aria-hidden>
							·
						</span>
						<Link href="/legal/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
							Privacy &amp; security
						</Link>
						<span className="text-muted-foreground/40" aria-hidden>
							·
						</span>
						<Link href="/legal/terms" className="underline-offset-4 hover:text-foreground hover:underline">
							Terms
						</Link>
						<span className="text-muted-foreground/40" aria-hidden>
							·
						</span>
						<Link href="/legal/refund" className="underline-offset-4 hover:text-foreground hover:underline">
							Refunds
						</Link>
					</nav>
					<p className="text-xs text-muted-foreground">
						© {new Date().getFullYear()} EduAI
					</p>
				</div>
			</footer>
		</>
	);
}
