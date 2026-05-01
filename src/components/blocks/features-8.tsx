import { FeatureInterventionRadar } from "@/components/blocks/feature-intervention-radar";
import { FeaturePerformanceRadial } from "@/components/blocks/feature-performance-radial";
import { GlowCard } from "@/components/ui/spotlight-card";
import { CpuArchitecture } from "@/components/ui/cpu-architecture";
import { Badge } from "@/components/ui/badge";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	BarChart3,
	GraduationCap,
	Presentation,
	ShieldCheck,
	Sparkles,
	UserRound,
	Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Marketing accent #3ECF8E; animates on `GlowCard`’s `group` hover. */
const featureCardTitleClassName =
	"text-card-foreground transition-colors duration-200 group-hover:text-[#3ECF8E]";

/** Top-left pill on each bento card; label uses neutrals—only Lucide icons use `#3ECF8E` via their own classes. */
const featureBentoCardEyebrowClassName =
	"border-border bg-muted/35 inline-flex min-h-[2.25rem] w-fit shrink-0 items-center gap-2 self-start justify-self-start rounded-full border px-3 py-1 text-xs text-muted-foreground";

export function Features() {
	return (
		<section id="features" className="bg-background py-16 sm:py-20">
			<div className="w-full px-4 sm:px-6 lg:px-8">
				<div className="mx-auto mb-12 max-w-3xl text-center">
					<Badge variant="outline" className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}>
						Features
					</Badge>
					<h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						Platform features built for measurable learning outcomes
					</h2>
					<p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
						Designed to improve student clarity, parent visibility, and teacher action with one
						connected workflow.
					</p>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-6">
					<GlowCard
						glowColor="green"
						customSize
						className={cn(
							"h-full md:col-span-2 min-h-[300px] sm:min-h-[320px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div className="relative z-10 flex h-full min-h-0 flex-col gap-3">
							<div className={featureBentoCardEyebrowClassName}>
								<BarChart3 className="size-3.5 text-[#3ECF8E]" />
								Progress analytics
							</div>
							<div className="border-border bg-muted/45 relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[15px] border p-2 sm:p-3">
								<div className="absolute left-2 top-1.5 flex gap-1 sm:left-3 sm:top-2">
									<span className="bg-muted-foreground/45 block size-1.5 rounded-full" />
									<span className="bg-muted-foreground/45 block size-1.5 rounded-full" />
									<span className="bg-muted-foreground/45 block size-1.5 rounded-full" />
								</div>
								<div className="flex min-h-0 flex-1 items-center justify-center px-1 py-2 sm:px-2 sm:py-3">
									<FeaturePerformanceRadial compact />
								</div>
							</div>
							<div className="shrink-0">
								<h3 className={cn("text-xl font-semibold sm:text-2xl", featureCardTitleClassName)}>
									Performance clarity
								</h3>
								<p className="text-muted-foreground mt-2 text-sm">
									Track topics, session quality, and readiness trends in one place.
								</p>
							</div>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="green"
						customSize
						className={cn(
							"h-full md:col-span-2 min-h-[300px] sm:min-h-[320px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div className="relative z-10 flex h-full min-h-0 flex-col gap-3">
							<div className={featureBentoCardEyebrowClassName}>
								<ShieldCheck className="size-3.5 text-[#3ECF8E]" />
								Security mesh
							</div>
							<div className="border-border bg-muted/45 relative min-h-0 flex-1 overflow-hidden rounded-[15px] border p-1.5">
								{/* inset-[5%] → graphic uses ~90% of width and height of the panel */}
								<div className="absolute inset-[5%] flex items-center justify-center">
									<CpuArchitecture
										className="text-muted-foreground h-full w-full max-h-full max-w-full"
										text="SAFE"
										lineMarkerSize={22}
									/>
								</div>
							</div>
							<div className="shrink-0">
								<h3 className={cn("text-xl font-semibold sm:text-2xl", featureCardTitleClassName)}>
									Secure by default
								</h3>
								<p className="text-muted-foreground mt-2 text-sm">
									Role-based permissions, parent linkage checks, and safer student defaults in every flow.
								</p>
							</div>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="green"
						customSize
						className={cn(
							"h-full md:col-span-2 min-h-[300px] sm:min-h-[320px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div className="relative z-10 flex h-full min-h-0 flex-col gap-3">
							<div className={featureBentoCardEyebrowClassName}>
								<Sparkles className="size-3.5 text-[#3ECF8E]" />
								Adaptive insight signals
							</div>
							<div className="border-border bg-muted/25 flex min-h-0 flex-1 items-center justify-center rounded-[15px] border px-1 py-2">
								<FeatureInterventionRadar />
							</div>
							<div className="shrink-0">
								<h3 className={cn("text-xl font-semibold sm:text-2xl", featureCardTitleClassName)}>
									Faster intervention loops
								</h3>
								<p className="text-muted-foreground mt-2 text-sm">
									Teachers spot drift sooner, students get targeted practice before exams.
								</p>
							</div>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="green"
						customSize
						className={cn(
							"relative bg-transparent md:col-span-3 min-h-[240px] sm:min-h-[260px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div
							className="bg-card pointer-events-none absolute inset-0 overflow-hidden rounded-[12px]"
							aria-hidden
						>
							{/* Plain <img> keeps GIF animation; Next/Image may strip frames. */}
							<img
								src="/marketing/subjects.gif"
								alt=""
								loading="lazy"
								decoding="async"
								className="size-full object-cover object-[center_35%] motion-reduce:hidden"
							/>
						</div>
					</GlowCard>

					<GlowCard
						glowColor="green"
						customSize
						className={cn(
							"md:col-span-3 min-h-[240px] sm:min-h-[260px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div className="relative z-10 grid h-full gap-5 sm:grid-cols-2">
							<div className="flex flex-col justify-between">
								<div className={featureBentoCardEyebrowClassName}>
									<Users className="size-3.5 text-[#3ECF8E]" />
									Student-parent-teacher sync
								</div>
								<div>
									<h3 className={cn("mt-4 text-xl font-semibold sm:text-2xl", featureCardTitleClassName)}>
										Shared accountability
									</h3>
									<p className="text-muted-foreground mt-2 text-sm">
										Everyone sees what matters, without noisy dashboards or guesswork.
									</p>
								</div>
							</div>
							<div className="border-border bg-muted/45 relative h-full rounded-[15px] border p-4">
								<div className="bg-border/80 absolute inset-y-4 left-1/2 w-px -translate-x-1/2" />
								<div className="relative flex h-full flex-col justify-center space-y-5 py-3">
									<div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
										<span className="border-border bg-muted/50 text-card-foreground rounded border px-2 py-1 text-xs">
											Student
										</span>
										<div
											className="ring-border bg-muted/50 flex size-7 items-center justify-center rounded-full ring-2"
											aria-hidden
										>
											<GraduationCap className="size-3.5 shrink-0 text-[#3ECF8E]" strokeWidth={2} />
										</div>
									</div>
									<div className="relative ml-[calc(50%-1rem)] flex items-center gap-2">
										<div
											className="ring-border bg-muted/50 flex size-8 items-center justify-center rounded-full ring-2"
											aria-hidden
										>
											<UserRound className="size-4 shrink-0 text-[#3ECF8E]" strokeWidth={2} />
										</div>
										<span className="border-border bg-muted/50 text-card-foreground rounded border px-2 py-1 text-xs">
											Parent
										</span>
									</div>
									<div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
										<span className="border-border bg-muted/50 text-card-foreground rounded border px-2 py-1 text-xs">
											Teacher
										</span>
										<div
											className="ring-border bg-muted/50 flex size-7 items-center justify-center rounded-full ring-2"
											aria-hidden
										>
											<Presentation className="size-3.5 shrink-0 text-[#3ECF8E]" strokeWidth={2} />
										</div>
									</div>
								</div>
							</div>
						</div>
					</GlowCard>
				</div>
			</div>
		</section>
	);
}
