"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ActivityIcon, BookOpenIcon, FlameIcon, LineChartIcon } from "lucide-react";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { pageHeaderSubtextScrollClass, pageHeaderSubtextTextClass } from "@/components/student/page-header-subtext";
import { SubjectCard, subjectStatusLabelToDashboardStatus } from "@/components/student/dashboard-subject-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cardSurfaceFrameClassName,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardOtherSubjectsTable } from "@/components/student/dashboard-other-subjects-table";
import type { StudentDashboardAnalyticsPayload } from "@/lib/student/dashboard-analytics";
import type { DashboardPerformanceStats } from "@/lib/student/dashboard-performance-stats";
import { partitionDashboardSubjectsByPriority } from "@/lib/student/dashboard-subject-priority";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { getSubjectCardIconConfig } from "@/lib/student/subject-lucide-icon";
import { StudentPerformanceTrackerHydrate } from "@/components/student/student-performance-tracker-hydrate";
import { cn } from "@/lib/utils";

/** Major section labels + in-column sub-labels: same type scale and alignment. */
const SECTION_LABEL_CLASS =
	"font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground";

const StudentDashboardAnalytics = dynamic(
	() =>
		import("@/components/student/student-dashboard-analytics").then((m) => ({
			default: m.StudentDashboardAnalytics,
		})),
	{
		loading: () => (
			<div
				className={cn(
					cardSurfaceFrameClassName,
					"flex min-h-[280px] flex-col gap-4 bg-muted/20 p-6",
				)}
				aria-busy
				aria-label="Loading analytics"
			>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-[200px] w-full rounded-lg" />
				<div className="grid gap-3 sm:grid-cols-2">
					<Skeleton className="h-32 w-full rounded-lg" />
					<Skeleton className="h-32 w-full rounded-lg" />
				</div>
			</div>
		),
	},
);

export type StudentDashboardSubjectCard = {
	subjectId: string;
	subjectName: string;
	percentCovered: number;
	topicTotal: number;
	attemptedCount: number;
	testsTaken: number;
	lastTestDateIso: string | null;
	status: SubjectStatusLabel;
	scorePercent: number | null;
	practiceHref: string;
};

export type StudentDashboardRecentTest = {
	id: string;
	subjectName: string;
	scorePercent: number | null;
	testDateIso: string | null;
	durationSeconds: number | null;
};

function formatLastTest(iso: string | null): string {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
	} catch {
		return "—";
	}
}

function formatMinutesLabel(minutes: number): string {
	if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const rem = minutes % 60;
	return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function averageScorePrimaryDisplay(
	average: number | null,
	isParent: boolean,
): { value: string; caption: string } {
	if (average != null) {
		return {
			value: `${average}%`,
			caption: isParent ? "From their graded tests in the last 30 days" : "From graded tests in the last 30 days",
		};
	}
	return {
		value: isParent ? "Not yet" : "Waiting",
		caption: isParent
			? "Their first graded test in this window unlocks a rolling average."
			: "Complete a graded test to unlock your rolling average.",
	};
}

function testsCompletedCaption(count: number, isParent: boolean): string {
	if (count > 0) {
		return isParent ? "Tests finished or graded for them" : "Tests you’ve finished or that are graded";
	}
	return isParent
		? "Their first finished test will show up here."
		: "Finish a test to watch this number climb.";
}

function timePracticingCaption(minutes: number, isParent: boolean): string {
	if (minutes > 0) {
		return isParent ? "Time they spent in timed tests, last 30 days" : "Time in timed tests, last 30 days";
	}
	return isParent
		? "Timed minutes from the last 30 days appear here once they start."
		: "Timed minutes stack here as you put in focused sessions.";
}

function topicProgressMotivation(
	mastered: number,
	needsWork: number,
	isParent: boolean,
): string | null {
	if (needsWork <= 0) return null;
	if (mastered === 0) {
		return isParent
			? "Each session they finish moves more of these toward on target."
			: "Pick a subject below; each session you finish moves topics toward solid.";
	}
	return isParent
		? "Extra practice still lifts the topics that are not on target yet."
		: "Keep going; every revisit chips away at what is still building.";
}

function formatDurationLabel(seconds: number | null): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "No duration logged";
	const roundedMinutes = Math.max(1, Math.round(seconds / 60));
	return `${roundedMinutes} min`;
}

function useStaggerVariants() {
	const reduceMotion = useReducedMotion();
	const y = reduceMotion ? 0 : 10;
	const stagger = reduceMotion ? 0 : 0.05;
	const duration = reduceMotion ? 0 : 0.24;

	const container = React.useMemo(
		() => ({
			hidden: {},
			show: {
				transition: { staggerChildren: stagger, delayChildren: reduceMotion ? 0 : 0.02 },
			},
		}),
		[reduceMotion, stagger],
	);

	const item = React.useMemo(
		() => ({
			hidden: { opacity: reduceMotion ? 1 : 0, y },
			show: {
				opacity: 1,
				y: 0,
				transition: { duration, ease: "easeOut" as const },
			},
		}),
		[duration, reduceMotion, y],
	);

	return { container, item, reduceMotion };
}

export type StudentDashboardViewProps = {
	headerGreeting: string;
	performanceStats: DashboardPerformanceStats;
	subjectCards: StudentDashboardSubjectCard[];
	subjectsLoadError: string | null;
	analytics: StudentDashboardAnalyticsPayload;
	recentTests: StudentDashboardRecentTest[];
	trackerNeedsHydration?: boolean;
	/** Parent portal reuses this view with read-only messaging and links under `/parent`. */
	variant?: "student" | "parent";
};

export function StudentDashboardView({
	headerGreeting,
	performanceStats,
	subjectCards,
	subjectsLoadError,
	analytics,
	recentTests,
	trackerNeedsHydration = false,
	variant = "student",
}: StudentDashboardViewProps) {
	const isParent = variant === "parent";
	const { container, item } = useStaggerVariants();

	const { priority: prioritySubjects, rest: restSubjects } = React.useMemo(
		() => partitionDashboardSubjectsByPriority(subjectCards, 2),
		[subjectCards],
	);

	const averageScoreDisplay = averageScorePrimaryDisplay(performanceStats.averageScoreLast30Days, isParent);
	const topicProgressBlurb = topicProgressMotivation(
		performanceStats.topicsMasteredCount,
		performanceStats.topicsNeedingImprovementCount,
		isParent,
	);

	return (
		<div className="flex flex-col gap-8 p-6">
			<StudentPerformanceTrackerHydrate needsHydration={trackerNeedsHydration} />
			<motion.div
				className="flex shrink-0 flex-col gap-1.5"
				initial="hidden"
				animate="show"
				variants={container}
			>
				<motion.h1
					className="font-semibold text-3xl tracking-tight text-balance text-foreground"
					variants={item}
				>
					{isParent ? "Overview" : "Dashboard"}
				</motion.h1>
				<motion.div className={pageHeaderSubtextScrollClass} variants={item}>
					<p className={pageHeaderSubtextTextClass}>{headerGreeting}</p>
				</motion.div>
			</motion.div>

			<section aria-labelledby="stats-heading" className="flex flex-col gap-3">
				<h2 id="stats-heading" className={SECTION_LABEL_CLASS}>
					At a glance
				</h2>
				<motion.div
					className="grid gap-5 md:grid-cols-12 md:items-stretch"
					initial="hidden"
					animate="show"
					variants={container}
				>
					<motion.div className="flex min-h-0 min-w-0 md:col-span-8" variants={item}>
						<Card className="h-full w-full min-w-0 shadow-none">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-semibold leading-snug">
									{isParent ? "Their practice signals" : "Practice signals"}
								</CardTitle>
								<CardDescription className="text-xs leading-snug">
									Tests, timed minutes, and scores (averages use the last 30 days).
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-5 sm:grid-cols-3">
								<div className="flex min-w-0 flex-col gap-2">
									<div className="flex items-center gap-2">
										<ActivityIcon
											className="size-5 shrink-0 text-sky-600 dark:text-sky-400"
											strokeWidth={2}
											aria-hidden
										/>
										<span className="text-muted-foreground text-xs font-medium leading-snug">
											Tests completed
										</span>
									</div>
									<p className="font-semibold text-2xl tabular-nums text-foreground">
										{performanceStats.testsCompleted}
									</p>
									<p className="text-muted-foreground text-xs leading-snug">
										{testsCompletedCaption(performanceStats.testsCompleted, isParent)}
									</p>
								</div>
								<div className="flex min-w-0 flex-col gap-2">
									<div className="flex items-center gap-2">
										<FlameIcon
											className="size-5 shrink-0 text-orange-600 dark:text-orange-400"
											strokeWidth={2}
											aria-hidden
										/>
										<span className="text-muted-foreground text-xs font-medium leading-snug">
											Time practicing
										</span>
									</div>
									<p className="font-semibold text-2xl tabular-nums text-foreground">
										{formatMinutesLabel(performanceStats.timeSpentMinutesLast30Days)}
									</p>
									<p className="text-muted-foreground text-xs leading-snug">
										{timePracticingCaption(performanceStats.timeSpentMinutesLast30Days, isParent)}
									</p>
								</div>
								<div className="flex min-w-0 flex-col gap-2">
									<div className="flex items-center gap-2">
										<LineChartIcon
											className="size-5 shrink-0 text-violet-600 dark:text-violet-400"
											strokeWidth={2}
											aria-hidden
										/>
										<span className="text-muted-foreground text-xs font-medium leading-snug">
											Average score
										</span>
									</div>
									<p className="font-semibold text-2xl tabular-nums text-foreground">{averageScoreDisplay.value}</p>
									<p className="text-muted-foreground text-xs leading-snug">{averageScoreDisplay.caption}</p>
								</div>
							</CardContent>
						</Card>
					</motion.div>
					<motion.div className="flex min-h-0 min-w-0 md:col-span-4" variants={item}>
						<Card className="h-full w-full min-w-0 shadow-none">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-semibold leading-snug">Topic progress</CardTitle>
								<CardAction>
									<BookOpenIcon
										className="size-7 text-subject-grid-icon"
										strokeWidth={2}
										aria-hidden
									/>
								</CardAction>
							</CardHeader>
							<CardContent className="flex flex-1 flex-col gap-4">
								<dl className="grid grid-cols-2 gap-x-4 gap-y-1">
									<div className="min-w-0">
										<dt className="text-muted-foreground text-xs font-medium leading-snug">
											{isParent ? "On target" : "Solid"}
										</dt>
										<dd className="font-semibold text-2xl tabular-nums text-foreground">
											{performanceStats.topicsMasteredCount}
										</dd>
									</div>
									<div className="min-w-0">
										<dt className="text-muted-foreground text-xs font-medium leading-snug">Still building</dt>
										<dd className="font-semibold text-2xl tabular-nums text-foreground">
											{performanceStats.topicsNeedingImprovementCount}
										</dd>
									</div>
								</dl>
								{topicProgressBlurb ? (
									<p className="mt-auto text-muted-foreground text-xs font-medium leading-snug">{topicProgressBlurb}</p>
								) : null}
							</CardContent>
						</Card>
					</motion.div>
				</motion.div>
			</section>

			<div className="grid min-h-0 gap-6 lg:grid-cols-3 lg:items-stretch">
				<section
					aria-labelledby="subjects-heading"
					className="flex min-h-0 min-w-0 flex-col gap-3 lg:col-span-2"
				>
					<h2 id="subjects-heading" className={cn(SECTION_LABEL_CLASS, "shrink-0")}>
						{isParent ? "Subjects" : "Subjects you study"}
					</h2>
					{subjectsLoadError ? (
						<Alert variant="destructive">
							<AlertTitle>Could not load tracker data</AlertTitle>
							<AlertDescription>{subjectsLoadError}</AlertDescription>
						</Alert>
					) : null}
					{subjectCards.length === 0 ? (
						<Card className="shadow-none">
							<CardHeader>
								<CardTitle className="text-sm font-semibold leading-snug">No subjects yet</CardTitle>
								<CardDescription>
									{isParent ? (
										<>
											Subjects come from their grade and school setup. If this stays empty, ask them to check class
											details in the student app or confirm enrollment with their school.
										</>
									) : (
										<>
											We load subjects from your grade and school setup. If this stays empty, open Profile and
											check your class details, or ask your school to confirm your enrollment.
										</>
									)}
								</CardDescription>
							</CardHeader>
						</Card>
					) : (
						<div className="flex flex-col gap-4">
							{prioritySubjects.length > 0 ? (
								<motion.div
									className="grid gap-3.5 sm:grid-cols-2 sm:gap-4"
									initial="hidden"
									animate="show"
									variants={container}
								>
									{prioritySubjects.map((s) => {
											const lastLabel = formatLastTest(s.lastTestDateIso);
											const hasAttempts = s.attemptedCount > 0;
											const cardStatus = subjectStatusLabelToDashboardStatus(s.status);
											const avgScore = s.scorePercent ?? 0;
											const { Icon, iconClassName, shellClassName } = getSubjectCardIconConfig(
												s.subjectName,
											);
											const subjectIcon = (
												<span
													className={cn(
														"flex size-10 shrink-0 items-center justify-center rounded-lg border sm:size-11",
														"border-border/80 ring-1",
														shellClassName,
													)}
													aria-hidden
												>
													<Icon
														className={cn("size-5 sm:size-[1.375rem]", iconClassName)}
														strokeWidth={1.25}
													/>
												</span>
											);

											return (
												<motion.div key={s.subjectId} className="min-h-0" variants={item}>
													{													!hasAttempts ? (
														<SubjectCard
															subject={s.subjectName}
															lastTestDate=""
															subtitle={
																s.lastTestDateIso
																	? `Last test · ${lastLabel}`
																	: "No tests recorded yet"
															}
															topicsAttempted={0}
															topicsTotal={s.topicTotal}
															testsTaken={0}
															avgScore={0}
															status="ready_to_start"
															ctaLabel={isParent ? "View performance" : "Start focus session"}
															ctaRender={<Link href={s.practiceHref} />}
															metricsIconSlot={subjectIcon}
														/>
													) : (
														<SubjectCard
															subject={s.subjectName}
															lastTestDate={lastLabel}
															topicsAttempted={s.attemptedCount}
															topicsTotal={s.topicTotal}
															testsTaken={s.testsTaken}
															avgScore={avgScore}
															status={cardStatus}
															ctaLabel={isParent ? "View performance" : "Start focus session"}
															ctaRender={<Link href={s.practiceHref} />}
															metricsIconSlot={subjectIcon}
														/>
													)}
												</motion.div>
											);
										})}
								</motion.div>
							) : null}

							{restSubjects.length > 0 ? (
								<div className="flex flex-col gap-2">
									{prioritySubjects.length > 0 ? (
										<p className={cn("m-0", SECTION_LABEL_CLASS)}>
											Other subjects · {restSubjects.length}
										</p>
									) : (
										<p className={cn("m-0", SECTION_LABEL_CLASS)}>
											All subjects · {restSubjects.length}
										</p>
									)}
									<div className={cn(cardSurfaceFrameClassName, "overflow-hidden p-5")}>
										<DashboardOtherSubjectsTable
											subjects={restSubjects}
											motionContainer={container}
											motionItem={item}
										/>
									</div>
								</div>
							) : null}
						</div>
					)}
				</section>

				<motion.div
					className="flex min-h-0 flex-col gap-6 lg:h-full"
					initial="hidden"
					animate="show"
					variants={container}
				>
					<section
						aria-labelledby="activity-heading"
						className="flex min-h-0 flex-col gap-3 lg:flex-1 lg:min-h-0"
					>
						<h2 id="activity-heading" className={SECTION_LABEL_CLASS}>
							{isParent ? "Their recent tests" : "Recent tests"}
						</h2>
						<motion.div variants={item} className="flex min-h-0 flex-1 flex-col">
							<Card className="flex min-h-0 flex-1 flex-col shadow-none">
								<CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-6">
									{recentTests.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											{isParent
												? "No completed tests yet. When they finish a timed practice test, it will show here."
												: "No completed tests yet. Finish a practice attempt to see it here."}
										</p>
									) : (
										recentTests.map((row) => (
											<div
												key={row.id}
												className="flex items-center justify-between gap-3 border-border border-b pb-3 last:border-0 last:pb-0"
											>
												<div className="min-w-0">
													<p className="truncate font-medium text-sm">{row.subjectName}</p>
													<p className="text-muted-foreground text-xs">
														{formatLastTest(row.testDateIso)} · {formatDurationLabel(row.durationSeconds)}
													</p>
												</div>
												<span className="shrink-0 font-mono text-sm tabular-nums">
													{row.scorePercent != null ? `${row.scorePercent}%` : "—"}
												</span>
											</div>
										))
									)}
									<Button
										variant="link"
										className="mt-auto h-auto px-0 pt-1 text-primary"
										render={<Link href={isParent ? "/parent/reports" : "/student/reports"} />}
									>
										{isParent ? "View test reports" : "Open reports"}
									</Button>
								</CardContent>
							</Card>
						</motion.div>
					</section>
				</motion.div>
			</div>

			<section aria-labelledby="charts-heading" className="flex flex-col gap-3">
				<h2 id="charts-heading" className={SECTION_LABEL_CLASS}>
					{isParent ? "Progress charts" : "Trends & charts"}
				</h2>
				<motion.div initial="hidden" animate="show" variants={container}>
					<motion.div variants={item}>
						<StudentDashboardAnalytics payload={analytics} variant={isParent ? "parent" : "student"} />
					</motion.div>
				</motion.div>
			</section>
		</div>
	);
}
