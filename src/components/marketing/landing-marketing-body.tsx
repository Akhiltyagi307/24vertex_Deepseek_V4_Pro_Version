import FeaturesSection from "@/components/ui/demo";
import RuixenFeaturedImageSection from "@/components/ui/ruixen-featured-image-section";
import { AcmeHero } from "@/components/ui/acme-hero";
import { Features } from "@/components/blocks/features-8";
import { Pricing } from "@/components/ui/single-pricing-card-1";
import Testimonials from "@/components/ui/testimonials";
import { Footer7 } from "@/components/ui/footer-7";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// three.js (~180KB) is loaded lazily on the client only — DottedSurface is a
// pure-decorative WebGL background; SSR can't render it and shipping it in the
// initial bundle inflates marketing-page TTI. The client wrapper handles the
// dynamic() call since `ssr: false` is restricted to client components.
import { DottedSurfaceLazy as DottedSurface } from "@/components/marketing/dotted-surface-lazy";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import {
	faqCardSurfaceClassName,
	pricingSectionGridOverlayClassName,
} from "@/lib/marketing/pricing-card-surface";
import {
	landingMarketingFaqRoleBadgeClassName,
	landingMarketingSectionEyebrowBadgeClassName,
} from "@/lib/marketing/landing-marketing-badge";
import {
	LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
} from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

const sectionShell = "w-full px-4 py-16 medium:px-6 medium:py-20 xl:px-8";
/** Band for full-width sections (matches CTA inner `max-w-7xl`). */
const sectionContentMax = "max-w-7xl";
const sectionTitle = "text-3xl font-semibold tracking-tight text-foreground medium:text-4xl";
const sectionLead = "mx-auto mt-3 max-w-2xl text-base text-muted-foreground medium:text-lg";

export function LandingMarketingBody() {
	return (
		<>
			<section id="home" className="w-full bg-background pb-10 pt-6 medium:pb-12 medium:pt-8">
				<AcmeHero />
			</section>

			<Features />

			<RuixenFeaturedImageSection />

			<FeaturesSection />

			<Testimonials />

			<Pricing />

			<section
				id="faq"
				className={cn("relative overflow-hidden bg-background", sectionShell)}
			>
				<div className={pricingSectionGridOverlayClassName} aria-hidden />
				<div
					className={cn(
						"relative z-10 mx-auto w-full space-y-8 medium:space-y-10",
						sectionContentMax,
					)}
				>
					<div className="mx-auto max-w-3xl space-y-4 text-center medium:space-y-6">
						<div className="flex justify-center">
							<Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
								FAQ
							</Badge>
						</div>
						<h2 className={cn(sectionTitle, "text-center")}>Common questions and answers</h2>
						<p
							className={cn(
								sectionLead,
								"mt-4 text-center leading-relaxed medium:text-lg medium:mt-6",
							)}
						>
							Find essential details about 24Vertex and how each role can get the most from it.
						</p>
					</div>

					<div className="w-full space-y-10">
						<div className="grid gap-3 xl:grid-cols-2 xl:gap-6">
						{[
							{
								id: "1",
								role: "All roles",
								question: "What is 24Vertex and who can use it?",
								answer:
									"24Vertex supports students, parents, and teachers with role-based portals. Students practice and prepare, teachers manage assignments and progress, and parents stay updated through linked visibility.",
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
								className={cn(
									"group relative z-10 overflow-hidden px-4 py-4 transition-shadow duration-200 ease-out medium:px-6 medium:py-6",
									faqCardSurfaceClassName,
									"open:shadow-[0_22px_55px_-28px_oklch(0.2_0.04_160/.55)]",
								)}
							>
								<summary className="flex cursor-pointer list-none items-start gap-3 rounded-md outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
									<span className="border-primary/35 bg-primary/10 text-link mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums">
										{item.id}
									</span>
									<div className="min-w-0 flex-1">
										<Badge variant="secondary" className={cn("text-[11px] font-medium", landingMarketingFaqRoleBadgeClassName)}>
											{item.role}
										</Badge>
										<h3 className="text-foreground mt-2 text-lg font-semibold tracking-tight medium:text-xl">
											{item.question}
										</h3>
									</div>
									<span
										aria-hidden
										className="text-muted-foreground group-open:text-primary mt-1 transition-[transform,color] duration-200 ease-out group-open:rotate-180"
									>
										<ChevronDown className="size-5" strokeWidth={2} />
									</span>
								</summary>
								<p className="text-muted-foreground mt-3 pl-10 text-sm leading-relaxed medium:text-[15px]">
									<span className="block max-w-[68ch] text-pretty">{item.answer}</span>
								</p>
							</details>
						))}
						</div>
						<div
							className={cn(
								"relative z-10 flex flex-wrap items-center justify-between gap-4 px-4 py-4 medium:px-6 medium:py-6",
								faqCardSurfaceClassName,
							)}
						>
							<p className="text-muted-foreground text-sm medium:text-base">
								Still have a question? Pick your role and we will route you to the right portal flow.
							</p>
							<Button
								// Brand-faithful pill, but `#63BB95` (mid-mint) only hit 2.31:1 with white
								// text — fails WCAG AA. Use the darker `--link` brand-green token so the
								// pill still reads as brand identity and the text clears AA (~7:1).
								className="h-10 shrink-0 rounded-full bg-[var(--link)] px-5 text-sm font-semibold text-white shadow-none [a]:hover:bg-[var(--link)]/90 dark:bg-[var(--link)] dark:[a]:hover:bg-[var(--link)]/90"
								render={<Link href="/signup/role-picker" />}
							>
								Start with role signup
							</Button>
						</div>
					</div>
				</div>
			</section>

			<section id="cta" className={`bg-background ${sectionShell}`}>
				<div
					className={cn(
						"relative mx-auto overflow-hidden rounded-2xl px-6 py-16 text-center medium:px-10 medium:py-20",
						sectionContentMax,
						landingFeatureBentoShell,
					)}
				>
					<DottedSurface className="absolute inset-0 z-0 opacity-90" />
					<div className="relative z-10 mx-auto max-w-2xl">
						<h2 className={cn(sectionTitle, "text-card-foreground")}>Start Smarter Practice Today</h2>
						<p className={sectionLead}>
							Adaptive tests, topic-level insights, and teacher-ready progress reports in one place.
						</p>
						<div
							className={cn(
								"mt-8 flex flex-wrap items-center justify-center",
								LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
							)}
						>
							<LandingPrimaryCtaButton render={<Link href="/signup/role-picker" />} />
							<Button
								className={LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME}
								variant="marketingSecondary"
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
