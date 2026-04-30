import FeaturesSection from "@/components/ui/demo";
import { AcmeHero } from "@/components/ui/acme-hero";
import { Features } from "@/components/blocks/features-8";
import { Pricing } from "@/components/ui/single-pricing-card-1";
import Testimonials from "@/components/ui/testimonials";
import { Footer7 } from "@/components/ui/footer-7";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { GridPattern } from "@/components/ui/grid-pattern";
import Link from "next/link";
import { LANDING_ROLE_SIGNUP_PRIMARY_CTA } from "@/lib/marketing/landing-copy";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";

const sectionShell = "w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8";
const sectionTitle = "text-3xl font-semibold tracking-tight text-foreground sm:text-4xl";
const sectionLead = "mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg";

export function LandingMarketingBody() {
	return (
		<>
			<section
				id="home"
				className="w-full border-b border-foreground/20 bg-background pb-10 pt-6 sm:pb-12 sm:pt-8"
			>
				<AcmeHero />
			</section>

			<Features />

			<FeaturesSection />

			<section id="how-it-works" className={`border-b border-foreground/20 ${sectionShell}`}>
				<div className="mx-auto max-w-3xl text-center">
					<Badge variant="outline" className="mb-4">
						How it works
					</Badge>
					<h2 className={sectionTitle}>How it works</h2>
					<p className={sectionLead}>
						Sign up once, complete your profile, and land directly in the portal built for your role.
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

			<Testimonials />

			<Pricing />

			<section id="faq" className={`relative overflow-hidden bg-background ${sectionShell}`}>
				<GridPattern
					width={32}
					height={32}
					x={-1}
					y={-1}
					className="fill-border/70 stroke-border/70 [mask-image:radial-gradient(ellipse_at_center,white,transparent_82%)]"
				/>
				<div className="relative z-10 mx-auto max-w-5xl">
					<div className="mx-auto max-w-3xl text-center">
						<Badge variant="outline" className="mb-4">
							FAQ
						</Badge>
						<h2 className={sectionTitle}>Common Questions &amp; Answers</h2>
						<p className={sectionLead}>
							Find essential details about EduAI and how each role can get the most from it.
						</p>
					</div>

					<div className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
						{[
							{
								id: "1",
								role: "All roles",
								question: "What is EduAI and who can use it?",
								answer:
									"EduAI supports students, parents, and teachers with role-based portals. Students practice and prepare, teachers manage assignments and progress, and parents stay updated through linked visibility.",
							},
							{
								id: "2",
								role: "All roles",
								question: "How do I get started on the right portal?",
								answer:
									"Use the role-specific signup entry point, complete your profile prompts, and you will be routed directly to the dashboard built for your role and permissions.",
							},
							{
								id: "3",
								role: "Teachers",
								question: "Can teachers assign work to specific classes?",
								answer:
									"Yes. Teachers can create and distribute assignments by class or section, then monitor completion and performance without leaving the teacher portal.",
							},
							{
								id: "4",
								role: "Parents",
								question: "What visibility do parents get?",
								answer:
									"Parents get read-only access to their linked child data such as assignments, progress reports, and relevant notifications designed for quick check-ins.",
							},
							{
								id: "5",
								role: "Students",
								question: "How does adaptive practice work for students?",
								answer:
									"Practice sessions prioritize weak areas and topic-level gaps while keeping curriculum alignment, helping students focus where progress impact is highest.",
							},
							{
								id: "6",
								role: "Parents & Teachers",
								question: "How often is data and progress information updated?",
								answer:
									"Reports and dashboards refresh as students complete practice and assignments, so teachers and parents can act on current performance trends.",
							},
						].map((item) => (
							<details
								key={item.id}
								className="group rounded-xl border border-border/70 bg-background/80 p-4 transition-colors hover:bg-accent/20 open:bg-accent/20"
							>
								<summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
									<span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-[11px] font-semibold text-muted-foreground">
										{item.id}
									</span>
									<div className="min-w-0 flex-1">
										<span className="inline-flex rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
											{item.role}
										</span>
										<h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
											{item.question}
										</h3>
									</div>
									<span
										aria-hidden
										className="mt-1 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
									>
										▾
									</span>
								</summary>
								<p className="mt-3 pl-9 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
									<span className="block max-w-[68ch] text-pretty">{item.answer}</span>
								</p>
							</details>
						))}
					</div>
					<div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 px-5 py-4">
						<p className="text-sm text-muted-foreground sm:text-base">
							Still have a question? Pick your role and we will route you to the right portal flow.
						</p>
						<Button size="sm" render={<Link href="/signup/role-picker" />}>
							Start with role signup
						</Button>
					</div>
				</div>
			</section>

			<section id="cta" className={`bg-background ${sectionShell}`}>
				<div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border/70 bg-background px-6 py-16 text-center sm:px-10 sm:py-20">
					<DottedSurface className="absolute inset-0 z-0" />
					<div className="relative z-10 mx-auto max-w-2xl">
						<h2 className={sectionTitle}>Start Smarter Practice Today</h2>
						<p className={sectionLead}>
							Adaptive tests, topic-level insights, and teacher-ready progress reports in one place.
						</p>
						<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
							<LandingPrimaryCtaButton render={<Link href="/signup/role-picker" />} />
							<Button
								className="h-11 rounded-full border-primary bg-transparent px-6 text-sm font-semibold text-primary shadow-none hover:bg-primary/10 hover:text-primary"
								variant="outline"
								render={<a href="#pricing" />}
							>
								Book a School Demo
							</Button>
						</div>
					</div>
				</div>
			</section>

			<footer className="bg-background">
				<div className={sectionShell}>
					<Footer7 />
				</div>
			</footer>
		</>
	);
}
