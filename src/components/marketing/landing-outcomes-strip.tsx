import { Badge } from "@/components/ui/badge";
import { GlowCard } from "@/components/ui/spotlight-card";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type Outcome = {
	headline: string;
	primary: string;
	caption: string;
	footnote?: string;
};

/**
 * Conservative, defensible numbers. Anchored to a real promoted testimonial
 * (Aarav: Physics 61 -> 84 in 6 weeks) plus product-truth statements that
 * don't require an aggregate sample. Update with real aggregate stats when
 * ready (see plan: numbers and assets needed from user).
 */
const OUTCOMES: Outcome[] = [
	{
		headline: "Real student, real subject, real result",
		primary: "61 → 84",
		caption: "Aarav, Class 11 · Physics · 6 weeks of revision",
		footnote: "Mock-test scores from a single student, before and after.",
	},
	{
		headline: "Doubts answered without asking the class",
		primary: "Two modes",
		caption: "Explain and Solve with me, every day after 4pm",
		footnote: "The hours when most homework actually happens.",
	},
	{
		headline: "Parents who stop chasing teachers",
		primary: "1 inbox",
		caption: "One weekly chapter-level report for every subject",
		footnote: "No WhatsApp threads, no screenshots, no surprises.",
	},
];

const sectionTitle =
	"text-3xl font-semibold tracking-tight text-foreground medium:text-4xl";
const sectionLead = marketingSectionLeadClassName;

export function LandingOutcomesStrip() {
	return (
		<section
			id="outcomes"
			// Asymmetric on purpose: outcomes flow tightly into Testimonials below
			// (claim → proof). Top padding matches the canonical section rhythm;
			// bottom padding stays small so the two sections read as coupled.
			className="bg-background pt-16 pb-6 medium:pt-20 medium:pb-8 xl:pt-24 xl:pb-10"
			aria-labelledby="outcomes-title"
		>
			<div className="mx-auto w-full max-w-7xl px-4 medium:px-6 xl:px-8">
				<div className={cn("mb-10 medium:mb-12", marketingSectionIntroWrapClassName)}>
					<Badge
						variant="outline"
						className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}
					>
						The proof
					</Badge>
					<h2 id="outcomes-title" className={cn(sectionTitle, "text-balance")}>
						When a child practises the right chapters, the marks follow.
					</h2>
					<p className={cn(sectionLead, "text-pretty")}>
						We will not throw aggregate numbers at you. Here is what the people who use
						24Vertex actually got back, in their own words and their own marksheets.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-3 medium:grid-cols-3 medium:gap-4">
					{OUTCOMES.map((outcome) => (
						<GlowCard
							key={outcome.headline}
							glowColor="green"
							customSize
							className={cn(
								"h-full overflow-hidden rounded-[12px] border p-5 medium:p-6",
								featureBentoCardSurfaceClassName,
							)}
						>
							<div className="relative z-10 flex h-full min-h-0 flex-col gap-3">
								<p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
									{outcome.headline}
								</p>
								<p className="text-foreground text-4xl font-extrabold tracking-tight medium:text-5xl">
									{outcome.primary}
								</p>
								<p className="text-card-foreground text-pretty text-[0.9375rem] font-medium leading-relaxed medium:text-base">
									{outcome.caption}
								</p>
								{outcome.footnote ? (
									<p className="text-muted-foreground mt-auto text-[0.8125rem] leading-relaxed">
										{outcome.footnote}
									</p>
								) : null}
							</div>
						</GlowCard>
					))}
				</div>
			</div>
		</section>
	);
}
