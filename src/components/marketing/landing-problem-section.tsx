import { ClockAlert, EarOff, Eye, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type ProblemStat = {
	value: string;
	label: string;
	sub: string;
};

type ProblemVisualKind = "class-size" | "too-late" | "silent-doubts" | "median";

type ProblemRow = {
	id: number;
	icon: LucideIcon;
	tag: string;
	title: string;
	body: string;
	visual: ProblemVisualKind;
	stats: [ProblemStat, ProblemStat];
};

/**
 * Four pains in parent vocabulary, mapped 1:1 to the problems the product
 * solves. Each row carries two supporting stats — ranges and labels, not
 * fabricated percentages — that quantify the pain without selling. Order is
 * deliberate: class dynamics → timing → silent doubts → personalisation.
 */
const PARENT_PROBLEMS: ProblemRow[] = [
	{
		id: 1,
		icon: Users,
		tag: "Class size",
		title: "One teacher cannot read 40 minds.",
		body: "Indian classrooms run 40 to 60 students per teacher. Even the best teacher cannot tell you which exact chapter your child is shaky on, every week, for every subject. The math just does not work.",
		visual: "class-size",
		stats: [
			{
				value: "40–60",
				label: "students per teacher",
				sub: "in a typical Indian classroom",
			},
			{
				value: "< 1 min",
				label: "per student, per chapter",
				sub: "if a teacher tried to read every mind, every week",
			},
		],
	},
	{
		id: 2,
		icon: ClockAlert,
		tag: "Too late",
		title: "You hear about the gap on report-card day.",
		body: "By the time the unit test, term paper, or board prep result lands in your hand, the gap is months old. Your child has already moved on to the next chapter, weaker. Now you are revising backwards under exam pressure.",
		visual: "too-late",
		stats: [
			{
				value: "8–12 weeks",
				label: "visibility lag",
				sub: "between a weak chapter and the report card that flags it",
			},
			{
				value: "3–4 chapters",
				label: "already moved past",
				sub: "by the time you find out, the syllabus has rolled on",
			},
		],
	},
	{
		id: 3,
		icon: EarOff,
		tag: "Silent doubts",
		title: "Your child has questions they will not ask out loud.",
		body: "Most students stop raising hands by class 7, because the room laughs at wrong answers. The doubts pile up at home, on a Sunday night, with a closed textbook and a shrug.",
		visual: "silent-doubts",
		stats: [
			{
				value: "Class 7",
				label: "is when hands stop going up",
				sub: "wrong answers cost too much in front of the class",
			},
			{
				value: "Sunday night",
				label: "is where the doubts land",
				sub: "a closed textbook, no one to ask, and a shrug",
			},
		],
	},
	{
		id: 4,
		icon: Eye,
		tag: "One-size-fits-all",
		title: "Schools have to teach for the median student.",
		body: "Curriculum, pace, and revision plans are built for the middle of the class. Your child is not in the middle of the class. They need their own plan, every week, for the chapters they actually missed.",
		visual: "median",
		stats: [
			{
				value: "1 of 40",
				label: "your child's ratio",
				sub: "in a teach-the-middle classroom built around the median",
			},
			{
				value: "Median pacing",
				label: "is by design, not failure",
				sub: "the school is doing what it can; your child still needs more",
			},
		],
	},
];

export function LandingProblemSection() {
	return (
		<section
			id="problem"
			className="bg-background py-16 medium:py-20 xl:py-24"
			aria-labelledby="problem-section-title"
		>
			<div className="mx-auto w-full max-w-7xl px-4 medium:px-6 xl:px-8">
				<div className={cn("mb-14 medium:mb-20", marketingSectionIntroWrapClassName)}>
					<Badge
						variant="outline"
						className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}
					>
						The reality
					</Badge>
					<h2
						id="problem-section-title"
						className="text-3xl font-semibold tracking-tight text-foreground text-balance medium:text-4xl"
					>
						Four reasons your child&rsquo;s marks are not moving, and the school cannot
						fix any of them on its own.
					</h2>
					<p className={cn(marketingSectionLeadClassName, "text-pretty")}>
						None of this is your child&rsquo;s fault. None of it is the school&rsquo;s
						fault either. It is just how the system is built. Here is what it actually
						looks like at home.
					</p>
				</div>

				<div className="flex flex-col gap-14 medium:gap-20">
					{PARENT_PROBLEMS.map((problem, idx) => {
						const reversed = idx % 2 === 1;
						const isLast = idx === PARENT_PROBLEMS.length - 1;
						return (
							<article
								key={problem.id}
								className={cn(
									"grid grid-cols-1 items-start gap-8 medium:gap-10",
									"xl:items-center xl:gap-x-12",
									reversed
										? "xl:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_minmax(16rem,18rem)] xl:[grid-template-areas:'stats_story_visual']"
										: "xl:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)_minmax(11rem,14rem)] xl:[grid-template-areas:'visual_story_stats']",
									!isLast && "border-border border-b pb-14 medium:pb-20",
								)}
								aria-labelledby={`problem-${problem.id}-title`}
							>
								<ProblemVisualPanel
									problem={problem}
									className="xl:[grid-area:visual]"
								/>
								<ProblemStory
									problem={problem}
									className={cn(
										"xl:[grid-area:story]",
										reversed
											? "xl:border-border xl:border-l xl:pl-12"
											: "xl:border-border xl:border-r xl:pr-12",
									)}
								/>
								<div
									className={cn(
										"grid min-w-0 grid-cols-1 gap-8 medium:grid-cols-2 xl:[grid-area:stats] xl:grid-cols-1 xl:gap-10 xl:self-center",
									)}
								>
									{problem.stats.map((stat, i) => (
										<ProblemStatBlock key={`${problem.id}-${i}`} stat={stat} />
									))}
								</div>
							</article>
						);
					})}
				</div>

				<p className="text-foreground mx-auto mt-14 max-w-4xl text-balance text-center text-sm font-medium medium:mt-20 medium:text-base">
					You cannot replace your child&rsquo;s school. You can give them the layer their
					school does not have time to give.
				</p>
			</div>
		</section>
	);
}

function ProblemVisualPanel({
	problem,
	className,
}: {
	problem: ProblemRow;
	className?: string;
}) {
	const Icon = problem.icon;
	return (
		<figure
			className={cn(
				"relative min-w-0 overflow-hidden rounded-2xl border bg-card",
				"w-full xl:h-full",
				featureBentoCardSurfaceClassName,
				"shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--card-foreground)_6%,transparent)]",
				className,
			)}
			role="img"
			aria-label={`${problem.tag}: ${problem.title}`}
		>
			<ProblemBackdrop />
			<div className="relative z-10 flex h-full min-h-[16rem] flex-col justify-between gap-6 p-5 medium:min-h-[18rem] medium:p-6">
				<div className="flex items-center gap-2.5">
					<span
						className="border-border bg-muted/45 ring-border/60 flex size-9 shrink-0 items-center justify-center rounded-xl border ring-1"
						aria-hidden
					>
						<Icon
							className="size-[18px] text-[var(--subject-grid-icon)]"
							strokeWidth={2}
						/>
					</span>
					<span className="border-border bg-muted/35 text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide">
						Reality 0{problem.id}
					</span>
				</div>

				<div className="flex flex-1 items-center justify-center">
					<ProblemVisualGraphic kind={problem.visual} />
				</div>

				<figcaption className="text-muted-foreground/85 text-[11px] font-medium uppercase tracking-wide">
					{problem.tag}
				</figcaption>
			</div>
		</figure>
	);
}

/** Subtle dot-grid backdrop that ties all four visuals into one visual family. */
function ProblemBackdrop() {
	return (
		<div
			className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(var(--muted-foreground)_1px,transparent_1px)] [background-size:14px_14px]"
			aria-hidden
		/>
	);
}

function ProblemStory({
	problem,
	className,
}: {
	problem: ProblemRow;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col justify-center gap-4 medium:gap-5",
				className,
			)}
		>
			<h3
				id={`problem-${problem.id}-title`}
				className="text-card-foreground text-2xl font-semibold tracking-tight text-pretty medium:text-3xl"
			>
				{problem.title}
			</h3>
			<p className="text-muted-foreground text-pretty text-[0.9375rem] leading-relaxed medium:text-base medium:leading-[1.65]">
				{problem.body}
			</p>
		</div>
	);
}

function ProblemStatBlock({ stat }: { stat: ProblemStat }) {
	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-foreground text-3xl font-medium tracking-tight tabular-nums medium:text-4xl">
				{stat.value}
			</p>
			<p className="text-foreground text-sm font-medium medium:text-base">
				{stat.label}
			</p>
			<p className="text-muted-foreground text-pretty text-sm leading-relaxed">
				{stat.sub}
			</p>
		</div>
	);
}

function ProblemVisualGraphic({ kind }: { kind: ProblemVisualKind }) {
	if (kind === "class-size") return <ClassSizeViz />;
	if (kind === "too-late") return <TooLateViz />;
	if (kind === "silent-doubts") return <SilentDoubtsViz />;
	return <MedianViz />;
}

/** 40 dots = a typical Indian classroom; one dot = your child. */
function ClassSizeViz() {
	const TOTAL = 40;
	const YOUR_CHILD_INDEX = 12;
	return (
		<div
			className="flex w-full max-w-[10rem] flex-col items-center gap-3"
			aria-hidden
		>
			<div className="grid grid-cols-5 gap-1.5">
				{Array.from({ length: TOTAL }).map((_, i) => {
					const isYou = i === YOUR_CHILD_INDEX;
					return (
						<span
							key={i}
							className={cn(
								"size-2.5 rounded-full transition-colors",
								isYou
									? "bg-[var(--subject-grid-icon)] ring-2 ring-[var(--subject-grid-icon)]/25 ring-offset-2 ring-offset-card"
									: "bg-muted-foreground/30",
							)}
						/>
					);
				})}
			</div>
			<p className="text-muted-foreground text-[10px] font-medium tracking-wide">
				<span className="text-[var(--subject-grid-icon)] font-semibold">
					Your child
				</span>{" "}
				· 1 of 40
			</p>
		</div>
	);
}

/** 12-week timeline. Weeks 1–10 = the silent gap; week 12 = the report card. */
function TooLateViz() {
	const WEEKS = 12;
	return (
		<div className="flex w-full max-w-[12rem] flex-col gap-3" aria-hidden>
			<div className="flex items-center justify-between gap-1">
				{Array.from({ length: WEEKS }).map((_, i) => {
					const isReportCard = i === WEEKS - 1;
					const inGap = i < WEEKS - 1;
					return (
						<span
							key={i}
							className={cn(
								"h-6 w-[3px] rounded-full",
								isReportCard
									? "bg-[var(--subject-grid-icon)]"
									: inGap
										? "bg-muted-foreground/35"
										: "bg-muted-foreground/20",
								isReportCard && "h-8",
							)}
						/>
					);
				})}
			</div>
			<div className="flex items-baseline justify-between text-[10px] font-medium tracking-wide">
				<span className="text-muted-foreground">Week 1</span>
				<span className="text-[var(--subject-grid-icon)] font-semibold">
					Report card
				</span>
			</div>
		</div>
	);
}

/** Three muted bubbles (questions never asked) + one highlighted "?". */
function SilentDoubtsViz() {
	return (
		<div
			className="flex w-full max-w-[11rem] flex-col items-start gap-1.5"
			aria-hidden
		>
			<span className="bg-muted-foreground/15 text-muted-foreground/70 inline-flex h-6 items-center rounded-2xl rounded-bl-sm px-3 text-[11px] font-medium tracking-tight">
				. . .
			</span>
			<span className="bg-muted-foreground/15 text-muted-foreground/70 inline-flex h-6 items-center rounded-2xl rounded-bl-sm px-3 text-[11px] font-medium tracking-tight">
				. . .
			</span>
			<span className="bg-muted-foreground/15 text-muted-foreground/70 inline-flex h-6 items-center rounded-2xl rounded-bl-sm px-3 text-[11px] font-medium tracking-tight">
				. . .
			</span>
			<span className="inline-flex h-7 items-center rounded-2xl rounded-bl-sm bg-[var(--subject-grid-icon)]/12 px-3.5 text-sm font-semibold text-[var(--subject-grid-icon)] ring-1 ring-[var(--subject-grid-icon)]/35">
				?
			</span>
		</div>
	);
}

/** Bell curve — median in green, your child off-centre in foreground. */
function MedianViz() {
	return (
		<svg
			viewBox="0 0 110 60"
			className="w-full max-w-[12rem]"
			role="presentation"
			aria-hidden
		>
			<path
				d="M5 50 Q 30 50, 55 8 Q 80 50, 105 50"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.25"
				className="text-muted-foreground/45"
				strokeLinecap="round"
			/>
			<line
				x1="55"
				y1="8"
				x2="55"
				y2="50"
				stroke="currentColor"
				strokeWidth="0.6"
				strokeDasharray="2 2"
				className="text-muted-foreground/30"
			/>
			<circle
				cx="55"
				cy="8"
				r="2.4"
				className="fill-[var(--subject-grid-icon)]"
			/>
			<circle cx="80" cy="35" r="2.4" className="fill-foreground" />
			<text
				x="55"
				y="58"
				textAnchor="middle"
				className="fill-muted-foreground"
				style={{ fontSize: "6px", fontWeight: 500, letterSpacing: "0.04em" }}
			>
				MEDIAN
			</text>
			<text
				x="80"
				y="30"
				textAnchor="middle"
				className="fill-foreground"
				style={{ fontSize: "6px", fontWeight: 600, letterSpacing: "0.02em" }}
			>
				YOUR CHILD
			</text>
		</svg>
	);
}
