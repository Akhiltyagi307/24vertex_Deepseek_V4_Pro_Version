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

/** Matches badge icon green (`--subject-grid-icon`); animates on `GlowCard`’s `group` hover. */
const featureCardTitleClassName =
	"text-card-foreground transition-colors duration-200 group-hover:text-subject-grid-icon";

/** Top-left pill on each bento card; `self-start` / `justify-self-start` avoid full-width stretch in grid/flex parents. */
const featureBentoCardEyebrowClassName =
	"border-border bg-muted/35 inline-flex w-fit shrink-0 items-center gap-2 self-start justify-self-start rounded-full border px-3 py-1 text-xs text-muted-foreground";

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
							"relative bg-transparent md:col-span-2 min-h-[190px] sm:min-h-[210px] overflow-hidden rounded-[12px] border",
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
							"md:col-span-2 min-h-[190px] sm:min-h-[210px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div className="relative z-10 grid h-full gap-4">
							<div className={featureBentoCardEyebrowClassName}>
								<ShieldCheck className="text-subject-grid-icon size-3.5" />
								Security mesh
							</div>
							<div className="border-border bg-muted/45 h-[112px] w-full rounded-[15px] border p-1.5">
								<CpuArchitecture className="text-muted-foreground h-full w-full" text="SAFE" lineMarkerSize={16} />
							</div>
							<div>
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
							"md:col-span-2 min-h-[300px] sm:min-h-[320px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div className="relative z-10 flex h-full flex-col gap-4">
							<div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
								<Sparkles className="text-subject-grid-icon size-4" />
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
							"md:col-span-3 min-h-[240px] sm:min-h-[260px] overflow-hidden rounded-[12px] border",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div className="relative z-10 grid h-full min-h-0 gap-5 sm:grid-cols-2">
							<div className="flex min-h-0 flex-col justify-between">
								<div className={featureBentoCardEyebrowClassName}>
									<BarChart3 className="text-subject-grid-icon size-3.5" />
									Progress analytics
								</div>
								<div>
									<h3 className={cn("mt-4 text-xl font-semibold sm:text-2xl", featureCardTitleClassName)}>
										Performance clarity
									</h3>
									<p className="text-muted-foreground mt-2 text-sm">
										Track topics, session quality, and readiness trends in one place.
									</p>
								</div>
							</div>
							<div className="border-border bg-muted/45 relative flex h-full w-full min-h-[188px] flex-col overflow-hidden rounded-[15px] border p-3 sm:min-h-[200px]">
								<div className="absolute left-3 top-2 flex gap-1">
									<span className="bg-muted-foreground/45 block size-1.5 rounded-full" />
									<span className="bg-muted-foreground/45 block size-1.5 rounded-full" />
									<span className="bg-muted-foreground/45 block size-1.5 rounded-full" />
								</div>
								<div className="flex min-h-0 flex-1 flex-col items-center justify-center pt-5 pb-1">
									<FeaturePerformanceRadial />
								</div>
							</div>
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
									<Users className="text-subject-grid-icon size-3.5" />
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
											<GraduationCap className="text-subject-grid-icon size-3.5 shrink-0" strokeWidth={2} />
										</div>
									</div>
									<div className="relative ml-[calc(50%-1rem)] flex items-center gap-2">
										<div
											className="ring-border bg-muted/50 flex size-8 items-center justify-center rounded-full ring-2"
											aria-hidden
										>
											<UserRound className="text-subject-grid-icon size-4 shrink-0" strokeWidth={2} />
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
											<Presentation className="text-subject-grid-icon size-3.5 shrink-0" strokeWidth={2} />
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
