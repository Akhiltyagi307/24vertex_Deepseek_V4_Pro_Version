import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import {
	landingMasteryPreviewDotClassNames,
	landingMasteryPreviewTextClassNames,
	type LandingMasteryPreviewState,
} from "@/lib/marketing/landing-mastery-preview-styles";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import { cn } from "@/lib/utils";

/**
 * A real product-faithful preview of the parent dashboard radar chart and the
 * Week 1 → Week 2 → Week 3 chapter-state arc described in `landing-copy.ts`.
 *
 * Entirely SSR-friendly: SVG radar + static chapter chips. No client JS.
 * Use only on `/parent-dashboard`.
 */

type ChapterState = LandingMasteryPreviewState;

type RadarPoint = {
	label: string;
	/** 0 to 100 mastery score; used both for the radar polygon and the chip dot. */
	value: number;
};

type WeekChip = {
	chapter: string;
	state: ChapterState;
	/** "+12", "-4", "0" mastery delta from prior week. */
	delta: string;
};

type WeekSlice = {
	label: string;
	dateRange: string;
	headline: string;
	chips: ReadonlyArray<WeekChip>;
};

const RADAR_CHAPTERS: ReadonlyArray<RadarPoint> = [
	{ label: "Number systems", value: 82 },
	{ label: "Polynomials", value: 88 },
	{ label: "Coordinate geometry", value: 64 },
	{ label: "Linear equations", value: 71 },
	{ label: "Triangles", value: 58 },
	{ label: "Quadrilaterals", value: 47 },
	{ label: "Areas of triangles", value: 74 },
	{ label: "Circles", value: 81 },
];

const RADAR_PRIOR: ReadonlyArray<number> = [78, 80, 49, 64, 41, 38, 70, 76];

const WEEKS: ReadonlyArray<WeekSlice> = [
	{
		label: "Week 1",
		dateRange: "5 to 11 May",
		headline: "Two amber chapters surfaced",
		chips: [
			{ chapter: "Triangles", state: "amber", delta: "" },
			{ chapter: "Quadrilaterals", state: "amber", delta: "" },
			{ chapter: "Number systems", state: "green", delta: "" },
		],
	},
	{
		label: "Week 2",
		dateRange: "12 to 18 May",
		headline: "Triangles turned green after practice",
		chips: [
			{ chapter: "Triangles", state: "green", delta: "+17" },
			{ chapter: "Quadrilaterals", state: "amber", delta: "+6" },
			{ chapter: "Number systems", state: "green", delta: "0" },
		],
	},
	{
		label: "Week 3",
		dateRange: "19 to 25 May",
		headline: "School announced test on circles next Friday",
		chips: [
			{ chapter: "Circles", state: "red", delta: "new" },
			{ chapter: "Quadrilaterals", state: "amber", delta: "+3" },
			{ chapter: "Coordinate geometry", state: "amber", delta: "-6" },
		],
	},
];

const STATE_DOT_CLASSNAMES = landingMasteryPreviewDotClassNames;
const STATE_LABEL_CLASSNAMES = landingMasteryPreviewTextClassNames;

const RADAR_SIZE = 320;
const RADAR_RADIUS = 128;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RINGS = [0.25, 0.5, 0.75, 1] as const;

function pointOnRadar(index: number, scale: number, total: number): { x: number; y: number } {
	const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
	return {
		x: RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS * scale,
		y: RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS * scale,
	};
}

function radarPolygon(values: ReadonlyArray<number>): string {
	return values
		.map((value, index) => {
			const { x, y } = pointOnRadar(index, value / 100, values.length);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
}

function labelPosition(index: number, total: number): { x: number; y: number; anchor: "start" | "middle" | "end" } {
	const { x, y } = pointOnRadar(index, 1.18, total);
	const dx = x - RADAR_CENTER;
	const anchor = Math.abs(dx) < 4 ? "middle" : dx > 0 ? "start" : "end";
	return { x, y, anchor };
}

function DeltaIcon({ delta }: { delta: string }) {
	if (delta === "new") {
		return null;
	}
	if (delta.startsWith("+")) {
		return <ArrowUpRight className="size-3" aria-hidden />;
	}
	if (delta.startsWith("-")) {
		return <ArrowDownRight className="size-3" aria-hidden />;
	}
	return <Minus className="size-3" aria-hidden />;
}

export function LandingRadarPreview() {
	const currentPolygon = radarPolygon(RADAR_CHAPTERS.map((c) => c.value));
	const priorPolygon = radarPolygon(RADAR_PRIOR);

	return (
		<section
			id="parent-dashboard-proof"
			className="bg-background px-4 py-20 medium:px-6 medium:py-24 xl:px-8 xl:py-28"
			aria-labelledby="parent-dashboard-proof-title"
		>
			<div className="mx-auto w-full max-w-7xl">
				<div className="mx-auto mb-10 max-w-3xl text-center medium:mb-12">
					<Badge variant="outline" className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}>
						The actual dashboard
					</Badge>
					<h2
						id="parent-dashboard-proof-title"
						className="text-balance text-3xl font-semibold tracking-tight text-foreground medium:text-4xl"
					>
						A live look at what you read on Sunday morning.
					</h2>
					<p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground medium:text-lg">
						Not a marketing diagram. This is the radar chart you and your child read from the same view, plus the three-week arc that tells you when to act.
					</p>
				</div>

				<div
					className={cn(
						"relative overflow-hidden rounded-3xl",
						landingFeatureBentoShell,
						"p-5 medium:p-8 xl:p-10",
					)}
				>
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 medium:pb-6">
						<div className="flex items-center gap-3">
							<span className="border-border bg-muted/45 ring-border/60 flex size-9 shrink-0 items-center justify-center rounded-xl border ring-1 text-[var(--subject-grid-icon)] font-semibold text-sm">
								AM
							</span>
							<div className="min-w-0">
								<p className="text-sm font-semibold text-card-foreground">Aarav Mehta</p>
								<p className="text-[12px] text-muted-foreground">Class 9 · CBSE · Maths · Term 1</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<span className="border-border bg-muted/35 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground">
								Updated Sun, 25 May
							</span>
						</div>
					</div>

					<div className="grid gap-8 pt-6 medium:pt-8 xl:grid-cols-[1.15fr_1fr] xl:gap-10">
						<div className="relative">
							<div className="mb-4 flex items-center justify-between gap-3">
								<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
									Chapter mastery radar
								</p>
								<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
									<span className="inline-flex items-center gap-1.5">
										<span className="inline-block size-2 rounded-full bg-[var(--subject-grid-icon)]" aria-hidden />
										This week
									</span>
									<span className="inline-flex items-center gap-1.5">
										<span className="inline-block size-2 rounded-full border border-[var(--subject-grid-icon)]/50 bg-transparent" aria-hidden />
										Last week
									</span>
								</div>
							</div>

							<div className="relative mx-auto w-full max-w-[420px]">
								<svg
									viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
									className="h-auto w-full"
									role="img"
									aria-label="Chapter mastery radar chart for Class 9 maths, showing this week's mastery polygon overlaid on last week's baseline."
								>
									{RADAR_RINGS.map((ring) => (
										<polygon
											key={ring}
											points={radarPolygon(RADAR_CHAPTERS.map(() => ring * 100))}
											fill="none"
											stroke="currentColor"
											className="text-border/60"
											strokeWidth={1}
										/>
									))}
									{RADAR_CHAPTERS.map((_, index) => {
										const { x, y } = pointOnRadar(index, 1, RADAR_CHAPTERS.length);
										return (
											<line
												key={`spoke-${index}`}
												x1={RADAR_CENTER}
												y1={RADAR_CENTER}
												x2={x}
												y2={y}
												stroke="currentColor"
												className="text-border/50"
												strokeWidth={1}
											/>
										);
									})}

									<polygon
										points={priorPolygon}
										fill="none"
										stroke="var(--subject-grid-icon)"
										strokeOpacity={0.55}
										strokeDasharray="4 3"
										strokeWidth={1.5}
									/>
									<polygon
										points={currentPolygon}
										fill="var(--subject-grid-icon)"
										fillOpacity={0.18}
										stroke="var(--subject-grid-icon)"
										strokeWidth={2}
									/>

									{RADAR_CHAPTERS.map((chapter, index) => {
										const { x, y } = pointOnRadar(index, chapter.value / 100, RADAR_CHAPTERS.length);
										return (
											<circle
												key={`dot-${chapter.label}`}
												cx={x}
												cy={y}
												r={3.5}
												fill="var(--subject-grid-icon)"
												stroke="var(--background)"
												strokeWidth={1.5}
											/>
										);
									})}

									{RADAR_CHAPTERS.map((chapter, index) => {
										const { x, y, anchor } = labelPosition(index, RADAR_CHAPTERS.length);
										return (
											<text
												key={`label-${chapter.label}`}
												x={x}
												y={y}
												textAnchor={anchor}
												dominantBaseline="middle"
												className="fill-muted-foreground text-[10px] font-medium"
											>
												{chapter.label}
											</text>
										);
									})}
								</svg>
							</div>
						</div>

						<div className="flex flex-col gap-5">
							<div>
								<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
									Three-week arc
								</p>
								<p className="mt-1 text-sm text-muted-foreground medium:text-[15px]">
									Updated as practice lands, not only when marks arrive.
								</p>
							</div>

							<ol className="flex flex-col gap-3">
								{WEEKS.map((week, index) => {
									const isCurrent = index === WEEKS.length - 1;
									return (
										<li
											key={week.label}
											className={cn(
												"rounded-2xl border px-4 py-3.5 medium:px-5 medium:py-4",
												isCurrent
													? "border-[var(--subject-grid-icon)]/40 bg-[var(--subject-grid-icon)]/8"
													: "border-border/70 bg-muted/30",
											)}
										>
											<div className="flex flex-wrap items-baseline justify-between gap-2">
												<p className="text-sm font-semibold text-card-foreground">
													{week.label}
													<span className="ml-2 font-normal text-muted-foreground">{week.dateRange}</span>
												</p>
												{isCurrent ? (
													<span className="border-[var(--subject-grid-icon)]/40 bg-[var(--subject-grid-icon)]/12 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
														You are here
													</span>
												) : null}
											</div>
											<p className="mt-1 text-[13px] text-muted-foreground medium:text-sm">
												{week.headline}
											</p>
											<ul className="mt-3 flex flex-wrap gap-1.5">
												{week.chips.map((chip) => (
													<li
														key={`${week.label}-${chip.chapter}`}
														className="border-border/60 bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-card-foreground medium:text-[12px]"
													>
														<span
															className={cn("inline-block size-1.5 rounded-full ring-2", STATE_DOT_CLASSNAMES[chip.state])}
															aria-hidden
														/>
														<span>{chip.chapter}</span>
														{chip.delta ? (
															<span
																className={cn(
																	"inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
																	chip.delta === "new"
																		? landingMasteryPreviewTextClassNames.red
																		: STATE_LABEL_CLASSNAMES[chip.state],
																)}
															>
																<DeltaIcon delta={chip.delta} />
																<span>{chip.delta}</span>
															</span>
														) : null}
													</li>
												))}
											</ul>
										</li>
									);
								})}
							</ol>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
