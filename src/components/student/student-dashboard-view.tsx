"use client";

import Link from "next/link";
import { ActivityIcon, FlameIcon, LineChartIcon } from "lucide-react";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

import { SubjectTopicRadarChart } from "@/components/charts/subject-topic-radar-chart";
import { pageHeaderSubtextScrollClass, pageHeaderSubtextTextClass } from "@/components/student/page-header-subtext";
import {
	SubjectCard,
	type SubjectCardTopicStatusCounts,
	subjectStatusLabelToDashboardStatus,
} from "@/components/student/dashboard-subject-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cardSurfaceFrameClassName,
} from "@/components/ui/card";
import { DashboardOtherSubjectsTable } from "@/components/student/dashboard-other-subjects-table";
import { StudentDashboardAssignmentsUrgencyCard } from "@/components/student/student-dashboard-assignments-urgency-card";
import { StudentDashboardLeaderboardCard } from "@/components/student/student-dashboard-leaderboard-card";
import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";
import type { StudentDashboardLeaderboardPayload } from "@/lib/student/dashboard-leaderboard";
import type { DashboardPerformanceStats } from "@/lib/student/dashboard-performance-stats";
import type { SubjectTopicRadarDatum } from "@/lib/charts/subject-topic-radar-config";
import { partitionDashboardSubjectsByPriority } from "@/lib/student/dashboard-subject-priority";
import { formatDateMediumInAppTimeZone } from "@/lib/datetime/app-timezone";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { getSubjectCardIconConfig, getTopicProgressCardIconConfig } from "@/lib/student/subject-lucide-icon";
import { StudentPerformanceTrackerHydrate } from "@/components/student/student-performance-tracker-hydrate";
import { cn } from "@/lib/utils";

/** Major section labels + in-column sub-labels: same type scale and alignment. */
const SECTION_LABEL_CLASS =
	"font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground";

const topicProgressHeaderIcon = getTopicProgressCardIconConfig();
const TopicProgressHeaderIcon = topicProgressHeaderIcon.Icon;

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
	/** Performance subject matrix — same destination as Performance page subject tiles. */
	performanceHref: string;
	/** When set, priority cards use the compact Performance tile layout (topic mix bar). */
	topicStatusCounts?: SubjectCardTopicStatusCounts;
};

function formatLastTest(iso: string | null): string {
	if (!iso) return "—";
	try {
		return formatDateMediumInAppTimeZone(iso);
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
		return isParent ? "Each session they finish moves more of these toward on target." : null;
	}
	return isParent
		? "Extra practice still lifts the topics that are not on target yet."
		: "Keep going; every revisit chips away at what is still building.";
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
	topicProgressRadar: SubjectTopicRadarDatum[];
	subjectsLoadError: string | null;
	openAssignments: StudentAssignmentCard[];
	leaderboard: StudentDashboardLeaderboardPayload;
	trackerNeedsHydration?: boolean;
	/** Parent portal reuses this view with read-only messaging and links under `/parent`. */
	variant?: "student" | "parent";
};

export function StudentDashboardView({
	headerGreeting,
	performanceStats,
	subjectCards,
	topicProgressRadar,
	subjectsLoadError,
	openAssignments,
	leaderboard,
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
		<div className="mx-0 flex w-full min-w-0 max-w-none flex-col gap-8 py-6 medium:py-8">
			<StudentPerformanceTrackerHydrate needsHydration={trackerNeedsHydration} />
			<motion.div
				className="flex w-full min-w-0 max-w-none shrink-0 flex-col gap-1.5"
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

			{/* `sm` aligns with inner subject cards: 640–767px is “mobile” shell but full-width main (< `md`). */}
			{/* Row 1: section label (left) + empty cell (right) so Topic progress lines up with subject cards, not the label. */}
			<div
				className={cn(
					"grid w-full min-w-0 max-w-none grid-cols-1 gap-4 xl:grid-cols-[minmax(0,13fr)_minmax(0,7fr)] xl:gap-x-5 xl:gap-y-4",
					prioritySubjects.length > 0 ? "xl:items-stretch" : "xl:items-start",
				)}
			>
				<h2
					id="subjects-heading"
					className={cn(SECTION_LABEL_CLASS, "shrink-0 xl:col-start-1 xl:row-start-1")}
				>
					{isParent ? "Subjects" : "Subjects you study"}
				</h2>
				<div
					className="hidden xl:block xl:col-start-2 xl:row-start-1"
					aria-hidden
				/>
				<section
					aria-labelledby="subjects-heading"
					className="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-start-2"
				>
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
						<>
							{prioritySubjects.length > 0 ? (
								<motion.div
									className="grid w-full min-w-0 max-w-none grid-cols-1 gap-3.5 xl:grid-cols-2 xl:gap-4"
									initial="hidden"
									animate="show"
									variants={container}
								>
									{prioritySubjects.map((s) => {
										const lastLabel = formatLastTest(s.lastTestDateIso);
										const hasTopics = s.topicTotal > 0;
										const topicStatusCounts = s.topicStatusCounts;
										const hasTrackerRows = topicStatusCounts != null;
										const hasAttempts = s.attemptedCount > 0;
										const cardStatus = subjectStatusLabelToDashboardStatus(s.status);
										const avgScore = s.scorePercent ?? 0;
										const href = s.performanceHref;
										const { Icon, iconClassName, shellClassName } = getSubjectCardIconConfig(s.subjectName);
										const subjectIcon = (
											<span
												className={cn(
													"flex size-10 shrink-0 items-center justify-center rounded-lg border medium:size-11",
													"border-border/80 ring-1",
													shellClassName,
												)}
												aria-hidden
											>
												<Icon
													className={cn("size-5 medium:size-[1.375rem]", iconClassName)}
													strokeWidth={1.25}
												/>
											</span>
										);
										const tileLinkClassName = cn(
											"group/tile block h-full min-h-0 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
										);

										if (!hasTopics) {
											const noTopicsHint = isParent
												? "No catalog topics for this grade yet."
												: "No catalog topics for your grade yet.";
											return (
												<motion.div
													key={s.subjectId}
													className="flex min-h-0 min-w-0 xl:h-full"
													variants={item}
												>
													<Link
														href={href}
														scroll
														aria-label={`Open ${s.subjectName} performance. ${noTopicsHint}`}
														className={tileLinkClassName}
													>
														<SubjectCard
															subject={s.subjectName}
															lastTestDate=""
															topicsAttempted={0}
															topicsTotal={0}
															testsTaken={0}
															avgScore={0}
															status="ready_to_start"
															showCta={false}
															showTileHint
															metricsIconSlot={subjectIcon}
															density="compact"
															className="min-h-0 w-full flex-1"
														/>
													</Link>
												</motion.div>
											);
										}

										if (!hasTrackerRows) {
											const trackerHint = isParent
												? "Topics load after curriculum links."
												: "Topics load after curriculum is linked.";
											return (
												<motion.div
													key={s.subjectId}
													className="flex min-h-0 min-w-0 xl:h-full"
													variants={item}
												>
													<Link
														href={href}
														scroll
														aria-label={`Open ${s.subjectName} performance. ${trackerHint}`}
														className={tileLinkClassName}
													>
														<SubjectCard
															subject={s.subjectName}
															lastTestDate=""
															topicsAttempted={0}
															topicsTotal={s.topicTotal}
															testsTaken={0}
															avgScore={0}
															status="ready_to_start"
															showCta={false}
															showTileHint
															metricsIconSlot={subjectIcon}
															density="compact"
															className="min-h-0 w-full flex-1"
														/>
													</Link>
												</motion.div>
											);
										}

										const noTestsHint = isParent
											? "No tests yet. Open subject to view topics."
											: "No tests yet. Open subject to start.";
										const subjectLinkAria = !hasAttempts
											? s.lastTestDateIso
												? `Open ${s.subjectName} performance. Last test ${lastLabel}.`
												: `Open ${s.subjectName} performance. ${noTestsHint}`
											: `Open ${s.subjectName} performance`;

										return (
											<motion.div
												key={s.subjectId}
												className="flex min-h-0 min-w-0 xl:h-full"
												variants={item}
											>
												<Link
													href={href}
													scroll
													aria-label={subjectLinkAria}
													className={tileLinkClassName}
												>
													<SubjectCard
														subject={s.subjectName}
														lastTestDate={lastLabel}
														topicsAttempted={s.attemptedCount}
														topicsTotal={s.topicTotal}
														testsTaken={s.testsTaken}
														avgScore={hasAttempts ? avgScore : 0}
														status={!hasAttempts ? "ready_to_start" : cardStatus}
														showCta={false}
														showTileHint
														topicStatusCounts={topicStatusCounts}
														metricsIconSlot={subjectIcon}
														density="compact"
														className="min-h-0 w-full flex-1"
													/>
												</Link>
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
									<Card className="min-w-0 overflow-hidden shadow-none">
										<CardContent className="p-4 medium:p-5">
											<DashboardOtherSubjectsTable
												subjects={restSubjects}
												motionContainer={container}
												motionItem={item}
											/>
										</CardContent>
									</Card>
								</div>
							) : null}
						</>
					)}
				</section>

				<motion.div
					className="flex min-h-0 w-full min-w-0 flex-col gap-3 xl:col-start-2 xl:row-start-2 xl:h-full xl:min-h-0"
					initial="hidden"
					animate="show"
					variants={container}
				>
					<motion.div variants={item} className="flex min-h-0 min-w-0 flex-1 flex-col xl:min-h-0">
						<Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-2 py-5 shadow-none">
							<CardHeader className="px-5 pb-1 pt-0">
								<CardTitle className="text-sm font-semibold leading-snug">Topic progress</CardTitle>
								<CardAction className="pt-0.5">
									<span
										className={cn(
											"flex size-10 shrink-0 items-center justify-center rounded-lg border medium:size-11",
											"border-border/80 ring-1",
											topicProgressHeaderIcon.shellClassName,
										)}
										aria-hidden
									>
										<TopicProgressHeaderIcon
											className={cn("size-5 medium:size-[1.375rem]", topicProgressHeaderIcon.iconClassName)}
											strokeWidth={1.25}
											aria-hidden
										/>
									</span>
								</CardAction>
							</CardHeader>
							<CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-5 pb-0 pt-0">
								{topicProgressRadar.length > 0 ? (
									<div className="flex aspect-[5/4] max-h-[420px] min-w-0 flex-col xl:aspect-auto xl:max-h-none xl:min-h-0 xl:flex-1 [&_[data-slot=chart]]:min-h-0 [&_[data-slot=chart]]:min-w-0 [&_[data-slot=chart]]:w-full">
										<SubjectTopicRadarChart
											data={topicProgressRadar}
											variant="dashboard"
											fillHeight
										/>
									</div>
								) : (
									<p className="text-muted-foreground text-xs font-medium leading-snug">
										{isParent
											? "Subject breakdown appears once their class lists subjects."
											: "Subject breakdown appears once your class lists subjects."}
									</p>
								)}
								{topicProgressBlurb ? (
									<p className="mt-auto shrink-0 text-muted-foreground text-xs font-medium leading-snug">
										{topicProgressBlurb}
									</p>
								) : null}
							</CardContent>
						</Card>
					</motion.div>

					<section
						aria-labelledby="stats-heading"
						className="flex w-full min-w-0 max-w-none shrink-0 flex-col gap-3"
					>
						<h2 id="stats-heading" className={SECTION_LABEL_CLASS}>
							At a glance
						</h2>
						<motion.div variants={item} className="w-full min-w-0">
							<Card size="sm" className="w-full min-w-0 shadow-none">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-semibold leading-snug">
										{isParent ? "Their practice signals" : "Practice signals"}
									</CardTitle>
									<CardDescription className="text-xs leading-snug">
										Tests, timed minutes, and scores (last 30 days for averages).
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-col divide-y divide-border/70 px-3 pb-4 pt-0 medium:px-4">
									<div className="flex min-w-0 flex-col gap-1.5 py-3 first:pt-0">
										<div className="flex min-w-0 items-start justify-between gap-3">
											<div className="flex min-w-0 items-center gap-2">
												<ActivityIcon
													className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
													strokeWidth={2}
													aria-hidden
												/>
												<span className="text-muted-foreground text-xs font-medium leading-snug">
													Tests completed
												</span>
											</div>
											<p className="shrink-0 text-right font-semibold text-xl tabular-nums text-foreground medium:text-2xl">
												{performanceStats.testsCompleted}
											</p>
										</div>
										<p className="text-muted-foreground text-[0.6875rem] leading-snug medium:text-xs">
											{testsCompletedCaption(performanceStats.testsCompleted, isParent)}
										</p>
									</div>
									<div className="flex min-w-0 flex-col gap-1.5 py-3">
										<div className="flex min-w-0 items-start justify-between gap-3">
											<div className="flex min-w-0 items-center gap-2">
												<FlameIcon
													className="size-4 shrink-0 text-orange-600 dark:text-orange-400"
													strokeWidth={2}
													aria-hidden
												/>
												<span className="text-muted-foreground text-xs font-medium leading-snug">
													Time practicing
												</span>
											</div>
											<p className="shrink-0 text-right font-semibold text-xl tabular-nums text-foreground medium:text-2xl">
												{formatMinutesLabel(performanceStats.timeSpentMinutesLast30Days)}
											</p>
										</div>
										<p className="text-muted-foreground text-[0.6875rem] leading-snug medium:text-xs">
											{timePracticingCaption(performanceStats.timeSpentMinutesLast30Days, isParent)}
										</p>
									</div>
									<div className="flex min-w-0 flex-col gap-1.5 py-3 pb-0">
										<div className="flex min-w-0 items-start justify-between gap-3">
											<div className="flex min-w-0 items-center gap-2">
												<LineChartIcon
													className="size-4 shrink-0 text-violet-600 dark:text-violet-400"
													strokeWidth={2}
													aria-hidden
												/>
												<span className="text-muted-foreground text-xs font-medium leading-snug">
													Average score
												</span>
											</div>
											<p className="shrink-0 text-right font-semibold text-xl tabular-nums text-foreground medium:text-2xl">
												{averageScoreDisplay.value}
											</p>
										</div>
										<p className="text-muted-foreground text-[0.6875rem] leading-snug medium:text-xs">
											{averageScoreDisplay.caption}
										</p>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					</section>
				</motion.div>
			</div>

			<section
				aria-labelledby="assignments-leaderboard-heading"
				className="flex w-full min-w-0 max-w-none flex-col gap-3"
			>
				<h2 id="assignments-leaderboard-heading" className={SECTION_LABEL_CLASS}>
					Assignments & leaderboard
				</h2>
				<motion.div
					className="grid w-full min-w-0 max-w-none grid-cols-1 gap-4 medium:grid-cols-2 medium:items-stretch medium:gap-6"
					initial="hidden"
					animate="show"
					variants={container}
				>
					<motion.div variants={item} className="flex min-w-0">
						<StudentDashboardAssignmentsUrgencyCard
							assignments={openAssignments}
							variant={isParent ? "parent" : "student"}
						/>
					</motion.div>
					<motion.div variants={item} className="flex min-w-0">
						<StudentDashboardLeaderboardCard
							leaderboard={leaderboard}
							variant={isParent ? "parent" : "student"}
						/>
					</motion.div>
				</motion.div>
			</section>
		</div>
	);
}
