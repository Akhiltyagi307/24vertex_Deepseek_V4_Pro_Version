import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { AcmeHero } from "@/components/ui/acme-hero";
// three.js (~180KB) is loaded lazily on the client only — DottedSurface is a
// pure-decorative WebGL background; SSR can't render it and shipping it in the
// initial bundle inflates marketing-page TTI.
import { DottedSurfaceLazy as DottedSurface } from "@/components/marketing/dotted-surface-lazy";
import { LandingHowItWorks } from "@/components/marketing/landing-how-it-works";
import { LandingOutcomesStrip } from "@/components/marketing/landing-outcomes-strip";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { LandingProblemSection } from "@/components/marketing/landing-problem-section";
import { LandingSchoolsAndTeachersBlock } from "@/components/marketing/landing-schools-and-teachers-block";
import { LandingTutorModes } from "@/components/marketing/landing-tutor-modes";
import { Features } from "@/components/blocks/features-8";
import FeaturesSection from "@/components/ui/demo";
import RuixenFeaturedImageSection from "@/components/ui/ruixen-featured-image-section";
import { Pricing } from "@/components/ui/single-pricing-card-1";
import Testimonials from "@/components/ui/testimonials";
import { Footer7 } from "@/components/ui/footer-7";
import { Badge } from "@/components/ui/badge";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import {
	faqCardSurfaceClassName,
	pricingSectionGridOverlayClassName,
} from "@/lib/marketing/pricing-card-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
	marketingSectionTitleClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { HELP_FAQ_CATEGORIES } from "@/lib/marketing/pages/help-faq";
import {
	LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
	LANDING_PARENT_PRIMARY_CTA_HREF,
	MARKETING_NAV,
} from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

// Canonical section rhythm for the landing page. Major sections all use this
// scale so the page reads as one rhythm across phone (64px), tablet (80px),
// laptop (96px). Smaller "band" sections (e.g. SchoolsAndTeachers) and the
// asymmetric-coupled OutcomesStrip declare their own padding intentionally.
const sectionShell =
	"w-full px-4 py-16 medium:px-6 medium:py-20 xl:px-8 xl:py-24";
/** Band for full-width sections (matches CTA inner `max-w-7xl`). */
const sectionContentMax = "max-w-7xl";
const sectionTitle = marketingSectionTitleClassName;
const sectionLead = marketingSectionLeadClassName;

type LandingMarketingBodyProps = {
	/** Optional support inbox forwarded to the schools-and-teachers band. */
	supportEmail?: string | null;
};

const PARENT_FAQ =
	HELP_FAQ_CATEGORIES.find((c) => c.id === "parents")?.items.map((item, i) => ({
		...item,
		id: String(i + 1),
	})) ?? [];

export function LandingMarketingBody({ supportEmail }: LandingMarketingBodyProps = {}) {
	return (
		<>
			<section id="home" className="w-full bg-background pb-10 pt-6 medium:pb-12 medium:pt-8">
				<AcmeHero />
			</section>

			<LandingProblemSection />

			<LandingHowItWorks />

			<LandingTutorModes />

			<Features />

			<RuixenFeaturedImageSection />

			<LandingOutcomesStrip />

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
					<div className={cn("space-y-4 medium:space-y-6", marketingSectionIntroWrapClassName)}>
						<div className="flex justify-center">
							<Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
								Parent FAQ
							</Badge>
						</div>
						<h2 className={cn(sectionTitle, "text-balance text-center")}>
							The questions every parent actually has before paying for one more app.
						</h2>
						<p
							className={cn(
								sectionLead,
								"mt-4 text-pretty text-center leading-relaxed medium:text-lg medium:mt-6",
							)}
						>
							Honest answers. No sales gloss.{" "}
							<Link href={MARKETING_NAV.help.href} className="text-link font-medium underline-offset-4 hover:underline">
								See all questions in Help
							</Link>
							.
						</p>
					</div>

					<div className="w-full space-y-10">
						<div className="grid gap-3 xl:grid-cols-2 xl:gap-6">
							{PARENT_FAQ.map((item) => (
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
											<h3 className="text-foreground text-pretty text-lg font-semibold tracking-tight medium:text-xl">
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
							<p className="text-muted-foreground text-pretty text-sm medium:text-base">
								Still on the fence? Start the trial. The first weak-chapter report lands in
								your inbox before you have time to second-guess yourself.
							</p>
							<LandingPrimaryCtaButton
								className="h-11 shrink-0"
								render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />}
							/>
						</div>
					</div>
				</div>
			</section>

			<LandingSchoolsAndTeachersBlock contactEmail={supportEmail ?? undefined} />

			<section id="cta" className={`bg-background ${sectionShell}`}>
				<div
					className={cn(
						"relative mx-auto overflow-hidden rounded-2xl px-6 py-16 text-center medium:px-10 medium:py-20",
						sectionContentMax,
						landingFeatureBentoShell,
					)}
				>
					<DottedSurface className="absolute inset-0 z-0 opacity-90" />
					<div className="relative z-10 mx-auto max-w-4xl">
						<h2 className={cn(sectionTitle, "text-card-foreground text-balance")}>
							This weekend, find out the three chapters dragging your child&rsquo;s marks down.
						</h2>
						<p className={cn(sectionLead, "text-pretty")}>
							14 days free. 5 practice tests. The Explain and Solve-with-me tutor included.
							No card needed. No school onboarding to wait for.
						</p>
						<div
							className={cn(
								"mt-8 flex flex-wrap items-center justify-center",
								LANDING_MARKETING_HERO_CTA_ROW_GAP_CLASSNAME,
							)}
						>
							<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />
						</div>
						<p className="text-muted-foreground/85 mt-5 text-xs medium:text-sm">
							Already have an account? <Link href="/login" className="text-link underline-offset-4 hover:underline">Log in</Link>.
						</p>
					</div>
				</div>
			</section>

			{/* Footer7 already declares its own `<section className="py-16 medium:py-20">` —
			    use horizontal-only padding here so the page doesn't double-pad the closing band. */}
			<footer className="bg-background w-full px-4 medium:px-6 xl:px-8">
				<Footer7 />
			</footer>
		</>
	);
}
