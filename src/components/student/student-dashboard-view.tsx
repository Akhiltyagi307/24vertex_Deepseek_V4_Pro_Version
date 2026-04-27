"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ActivityIcon, BookOpenIcon, CalendarClockIcon, FlameIcon, LineChartIcon } from "lucide-react";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { pageHeaderSubtextScrollClass, pageHeaderSubtextTextClass } from "@/components/student/page-header-subtext";
import { SubjectCard, subjectStatusLabelToDashboardStatus } from "@/components/student/dashboard-subject-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
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

export type StudentDashboardAssignmentSummary = {
	pendingCount: number;
	overdueCount: number;
	completedCount: number;
	nextDueTitle: string | null;
	nextDueIso: string | null;
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
	assignmentSummary: StudentDashboardAssignmentSummary;
};

export function StudentDashboardView({
	headerGreeting,
	performanceStats,
	subjectCards,
	subjectsLoadError,
	analytics,
	recentTests,
	assignmentSummary,
}: StudentDashboardViewProps) {
	const { container, item } = useStaggerVariants();

	const { priority: prioritySubjects, rest: restSubjects } = React.useMemo(
		() => partitionDashboardSubjectsByPriority(subjectCards, 2),
		[subjectCards],
	);

	return (
		<div className="flex flex-col gap-8 p-6">
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
					Dashboard
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
					className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
					initial="hidden"
					animate="show"
					variants={container}
				>
					<motion.div variants={item}>
						<Card className="shadow-none">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Tests completed</CardTitle>
								<ActivityIcon
									className="size-8 shrink-0 text-sky-600 dark:text-sky-400"
									strokeWidth={2}
									aria-hidden
								/>
							</CardHeader>
							<CardContent>
								<p className="font-semibold text-2xl tabular-nums">{performanceStats.testsCompleted}</p>
								<p className="text-muted-foreground text-xs">Tests you’ve finished or that are graded</p>
							</CardContent>
						</Card>
					</motion.div>
					<motion.div variants={item}>
						<Card className="shadow-none">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Average score</CardTitle>
								<LineChartIcon
									className="size-8 shrink-0 text-violet-600 dark:text-violet-400"
									strokeWidth={2}
									aria-hidden
								/>
							</CardHeader>
							<CardContent>
								<p className="font-semibold text-2xl tabular-nums">
									{performanceStats.averageScoreLast30Days != null
										? `${performanceStats.averageScoreLast30Days}%`
										: "—"}
								</p>
								<p className="text-muted-foreground text-xs">From graded tests in the last 30 days</p>
							</CardContent>
						</Card>
					</motion.div>
					<motion.div variants={item}>
						<Card className="shadow-none">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Topic mastery</CardTitle>
								<BookOpenIcon
									className="size-8 shrink-0 text-subject-grid-icon"
									strokeWidth={2}
									aria-hidden
								/>
							</CardHeader>
							<CardContent>
								<p className="font-semibold text-2xl tabular-nums">
									{performanceStats.topicsMasteredCount}
								</p>
								<p className="text-muted-foreground text-xs tabular-nums">
									{performanceStats.topicsNeedingImprovementCount} topics to revisit
								</p>
							</CardContent>
						</Card>
					</motion.div>
					<motion.div variants={item}>
						<Card className="shadow-none">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<CardTitle className="min-w-0 flex-1 font-medium text-sm">Time practicing</CardTitle>
								<FlameIcon
									className="size-8 shrink-0 text-orange-600 dark:text-orange-400"
									strokeWidth={2}
									aria-hidden
								/>
							</CardHeader>
							<CardContent>
								<p className="font-semibold text-2xl tabular-nums">
									{formatMinutesLabel(performanceStats.timeSpentMinutesLast30Days)}
								</p>
								<p className="text-muted-foreground text-xs">Time in timed tests, last 30 days</p>
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
						Subjects you study
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
									We load subjects from your grade and school setup. If this stays empty, open Profile and
									check your class details, or ask a teacher to confirm your enrollment.
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
													{!hasAttempts ? (
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
															status="in_progress"
															ctaLabel="Start focus session"
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
															ctaLabel="Start focus session"
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
									<div className={cn(cardSurfaceFrameClassName, "overflow-hidden p-[22px]")}>
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
					<section aria-labelledby="assignments-heading" className="flex shrink-0 flex-col gap-3">
						<h2 id="assignments-heading" className={SECTION_LABEL_CLASS}>
							Assignments
						</h2>
						<motion.div variants={item}>
							<Card className="shadow-none">
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between gap-2">
										<CardTitle className="text-sm font-semibold leading-snug">Assignment status</CardTitle>
										{assignmentSummary.overdueCount > 0 ? (
											<Badge variant="destructive">{assignmentSummary.overdueCount} overdue</Badge>
										) : null}
									</div>
									<CardDescription>What your teachers have set for your grade and section</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-col gap-3 text-sm">
									<div className="grid grid-cols-3 gap-2">
										<div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
											<p className="text-muted-foreground text-xs">Pending</p>
											<p className="font-semibold tabular-nums">{assignmentSummary.pendingCount}</p>
										</div>
										<div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
											<p className="text-muted-foreground text-xs">Overdue</p>
											<p className="font-semibold tabular-nums">{assignmentSummary.overdueCount}</p>
										</div>
										<div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
											<p className="text-muted-foreground text-xs">Completed</p>
											<p className="font-semibold tabular-nums">{assignmentSummary.completedCount}</p>
										</div>
									</div>
									{assignmentSummary.nextDueTitle ? (
										<div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
											<CalendarClockIcon className="mt-0.5 shrink-0 text-muted-foreground" />
											<div className="flex flex-col gap-0.5">
												<p className="font-medium">{assignmentSummary.nextDueTitle}</p>
												<p className="text-muted-foreground text-xs">
													Due {formatLastTest(assignmentSummary.nextDueIso)}
												</p>
											</div>
										</div>
									) : (
										<p className="text-muted-foreground text-xs">
											Nothing due soon—check with your class if you expected homework here.
										</p>
									)}
								</CardContent>
								<CardFooter>
									<Button variant="secondary" className="w-full" render={<Link href="/student/practice" />}>
										Start a practice test
									</Button>
								</CardFooter>
							</Card>
						</motion.div>
					</section>

					<section
						aria-labelledby="activity-heading"
						className="flex min-h-0 flex-col gap-3 lg:flex-1 lg:min-h-0"
					>
						<h2 id="activity-heading" className={SECTION_LABEL_CLASS}>
							Recent tests
						</h2>
						<motion.div variants={item} className="flex min-h-0 flex-1 flex-col">
							<Card className="flex min-h-0 flex-1 flex-col shadow-none">
								<CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-6">
									{recentTests.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											No completed tests yet. Finish a practice or assignment attempt to see it here.
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
										render={<Link href="/student/reports" />}
									>
										Open reports
									</Button>
								</CardContent>
							</Card>
						</motion.div>
					</section>
				</motion.div>
			</div>

			<section aria-labelledby="charts-heading" className="flex flex-col gap-3">
				<h2 id="charts-heading" className={SECTION_LABEL_CLASS}>
					Trends &amp; charts
				</h2>
				<motion.div initial="hidden" animate="show" variants={container}>
					<motion.div variants={item}>
						<StudentDashboardAnalytics payload={analytics} />
					</motion.div>
				</motion.div>
			</section>
		</div>
	);
}
