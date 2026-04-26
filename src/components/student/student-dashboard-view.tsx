"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
	ActivityIcon,
	ArrowRightIcon,
	BookOpenIcon,
	CalendarClockIcon,
	CircleDashedIcon,
	FlameIcon,
	LineChartIcon,
} from "lucide-react";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

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
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudentDashboardAnalyticsPayload } from "@/lib/student/dashboard-analytics";
import type { DashboardPerformanceStats } from "@/lib/student/dashboard-performance-stats";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { getSubjectCardIconConfig } from "@/lib/student/subject-lucide-icon";
import { cn } from "@/lib/utils";

const StudentDashboardAnalytics = dynamic(
	() =>
		import("@/components/student/student-dashboard-analytics").then((m) => ({
			default: m.StudentDashboardAnalytics,
		})),
	{
		loading: () => (
			<div
				className="flex min-h-[280px] flex-col gap-4 rounded-xl border border-border bg-muted/20 p-6"
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

function statusBadgeVariant(status: SubjectStatusLabel) {
	if (status === "Good") return "default" as const;
	if (status === "Bad") return "destructive" as const;
	return "secondary" as const;
}

function trackerStatusBadgeClass(status: SubjectStatusLabel): string {
	if (status === "Good") {
		return "border-primary/30 bg-primary/12 text-primary shadow-[0_0_14px_-6px_var(--primary)]";
	}
	if (status === "Bad") {
		return "";
	}
	return "border-amber-500/35 bg-amber-500/[0.09] text-amber-800 dark:text-amber-400";
}

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
				<motion.p
					className="text-muted-foreground text-base leading-relaxed max-w-2xl"
					variants={item}
				>
					{headerGreeting}
				</motion.p>
			</motion.div>

			<section aria-labelledby="stats-heading" className="flex flex-col gap-3">
				<h2 id="stats-heading" className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					At a glance
				</h2>
				<motion.div
					className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
					initial="hidden"
					animate="show"
					variants={container}
				>
					<motion.div variants={item}>
						<Card className="border-border shadow-none">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<CardTitle className="min-w-0 flex-1 font-medium text-sm">Tests completed</CardTitle>
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
						<Card className="border-border shadow-none">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<CardTitle className="min-w-0 flex-1 font-medium text-sm">Average score</CardTitle>
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
						<Card className="border-border shadow-none">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<CardTitle className="min-w-0 flex-1 font-medium text-sm">Topic mastery</CardTitle>
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
						<Card className="border-border shadow-none">
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

			<div className="grid min-h-0 gap-6 lg:grid-cols-3 lg:items-start">
				<section
					aria-labelledby="subjects-heading"
					className="flex min-h-0 min-w-0 flex-col gap-3 lg:col-span-2"
				>
					<div className="flex shrink-0 items-end justify-between gap-4">
						<h2 id="subjects-heading" className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Subjects you study
						</h2>
						<Button size="sm" variant="outline" render={<Link href="/student/practice" />}>
							Start new test
							<ArrowRightIcon data-icon="inline-end" />
						</Button>
					</div>
					{subjectsLoadError ? (
						<Alert variant="destructive">
							<AlertTitle>Could not load tracker data</AlertTitle>
							<AlertDescription>{subjectsLoadError}</AlertDescription>
						</Alert>
					) : null}
					{subjectCards.length === 0 ? (
						<Card className="border-border shadow-none">
							<CardHeader>
								<CardTitle className="text-base">No subjects yet</CardTitle>
								<CardDescription>
									We load subjects from your grade and school setup. If this stays empty, open Profile and
									check your class details, or ask a teacher to confirm your enrollment.
								</CardDescription>
							</CardHeader>
						</Card>
					) : (
						<div
							className={cn(
								"min-h-0 max-h-[min(68vh,44rem)] overflow-x-hidden overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]",
								"scroll-smooth [scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_32%,transparent)_transparent]",
								"[scrollbar-width:thin]",
							)}
							role="region"
							aria-label="Your subjects — scroll to see more"
						>
							<motion.div
								className="grid gap-3.5 pb-2 sm:grid-cols-2 sm:gap-4"
								initial="hidden"
								animate="show"
								variants={container}
							>
								{subjectCards.map((s) => {
									const { Icon, shellClassName, iconClassName } = getSubjectCardIconConfig(
										s.subjectName,
									);
									const lastLabel = formatLastTest(s.lastTestDateIso);
									const hasTopics = s.topicTotal > 0;
									const hasAttempts = s.attemptedCount > 0;

									return (
										<motion.div key={s.subjectId} className="min-h-0" variants={item}>
											<Card
												className={cn(
													"flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-none",
													"transition-[box-shadow,border-color,transform] duration-200 ease-out",
													"hover:border-primary/25 hover:shadow-[0_12px_40px_-24px_color-mix(in_oklab,var(--primary)_38%,transparent)]",
												)}
											>
												<CardHeader className="space-y-0 pb-0 pt-4">
													<div className="flex gap-3">
														<div
															className={cn(
																"flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
																shellClassName,
															)}
															aria-hidden
														>
															<Icon className={cn("size-5", iconClassName)} strokeWidth={2} />
														</div>
														<div className="min-w-0 flex-1 space-y-2">
															<div className="flex items-start justify-between gap-2">
																<CardTitle className="text-base font-semibold leading-snug tracking-tight">
																	{s.subjectName}
																</CardTitle>
																{!hasTopics ? (
																	<Badge
																		variant="outline"
																		className="shrink-0 border-dashed border-muted-foreground/40 text-muted-foreground"
																	>
																		No topics
																	</Badge>
																) : !hasAttempts ? (
																	<Badge
																		variant="outline"
																		className="shrink-0 gap-1 border-border bg-muted/40 text-muted-foreground"
																	>
																		<CircleDashedIcon className="size-3 opacity-80" aria-hidden />
																		Not started
																	</Badge>
																) : (
																	<Badge
																		variant={statusBadgeVariant(s.status)}
																		className={cn(
																			"shrink-0 font-medium",
																			trackerStatusBadgeClass(s.status),
																		)}
																	>
																		{s.status}
																	</Badge>
																)}
															</div>
															<p className="text-[0.6875rem] text-muted-foreground leading-snug tracking-wide uppercase">
																{s.lastTestDateIso
																	? `Last test · ${lastLabel}`
																	: "No tests recorded yet"}
															</p>
														</div>
													</div>
												</CardHeader>
												<CardContent className="flex flex-1 flex-col gap-3 pt-4 pb-2">
													{!hasTopics ? (
														<div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
															<p className="text-muted-foreground text-sm leading-snug">
																Topics aren’t linked for this subject yet. Your teacher or admin may still be setting this up.
															</p>
														</div>
													) : !hasAttempts ? (
														<div className="flex gap-2.5 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
															<BookOpenIcon
																className="mt-0.5 size-4 shrink-0 text-subject-grid-icon"
																strokeWidth={2.25}
																aria-hidden
															/>
															<p className="text-muted-foreground text-sm leading-snug">
																Take a practice test here to start seeing scores and how much of the syllabus you’ve tried.
															</p>
														</div>
													) : (
														<div className="flex flex-col gap-2.5">
															<div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
																<div>
																	<p className="text-muted-foreground text-[11px] uppercase tracking-wide">
																		Avg score
																	</p>
																	<p className="font-semibold text-xl tabular-nums tracking-tight text-foreground">
																		{s.scorePercent != null ? `${s.scorePercent}%` : "—"}
																	</p>
																</div>
																<div>
																	<p className="text-muted-foreground text-[11px] uppercase tracking-wide">
																		Coverage
																	</p>
																	<p className="font-semibold text-xl tabular-nums tracking-tight text-foreground">
																		{s.percentCovered}%
																	</p>
																</div>
															</div>
															<div className="space-y-1.5 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:rounded-full [&_[data-slot=progress-track]]:bg-muted/80">
																<Progress value={Math.min(100, Math.max(0, s.percentCovered))} />
																<p className="text-muted-foreground text-xs tabular-nums">
																	{s.attemptedCount} of {s.topicTotal} topics attempted · {s.testsTaken} test
																	{s.testsTaken === 1 ? "" : "s"}
																</p>
															</div>
														</div>
													)}
												</CardContent>
												<CardFooter className="mt-auto flex justify-start border-border/50 border-t bg-muted/15 px-4 pt-3 pb-4">
													<Button
														className="min-w-[6.75rem] w-auto px-4 font-medium shadow-sm"
														size="sm"
														render={<Link href={s.practiceHref} />}
													>
														Practice focus
													</Button>
												</CardFooter>
											</Card>
										</motion.div>
									);
								})}
							</motion.div>
						</div>
					)}
				</section>

				<motion.div
					className="flex flex-col gap-6"
					initial="hidden"
					animate="show"
					variants={container}
				>
					<section aria-labelledby="assignments-heading" className="flex flex-col gap-3">
						<h2 id="assignments-heading" className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Assignments
						</h2>
						<motion.div variants={item}>
							<Card className="border-border shadow-none">
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between gap-2">
										<CardTitle className="text-base">Assignment status</CardTitle>
										{assignmentSummary.overdueCount > 0 ? (
											<Badge variant="destructive">{assignmentSummary.overdueCount} overdue</Badge>
										) : null}
									</div>
									<CardDescription>What your teachers have set for your grade and section</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-col gap-3 text-sm">
									<div className="grid grid-cols-3 gap-2">
										<div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
											<p className="text-muted-foreground text-[11px]">Pending</p>
											<p className="font-semibold tabular-nums">{assignmentSummary.pendingCount}</p>
										</div>
										<div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
											<p className="text-muted-foreground text-[11px]">Overdue</p>
											<p className="font-semibold tabular-nums">{assignmentSummary.overdueCount}</p>
										</div>
										<div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
											<p className="text-muted-foreground text-[11px]">Completed</p>
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

					<section aria-labelledby="activity-heading" className="flex flex-col gap-3">
						<h2 id="activity-heading" className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Recent tests
						</h2>
						<motion.div variants={item}>
							<Card className="border-border shadow-none">
								<CardContent className="flex flex-col gap-3 pt-6">
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
									<Button variant="link" className="h-auto px-0 text-primary" render={<Link href="/student/reports" />}>
										Open reports
									</Button>
								</CardContent>
							</Card>
						</motion.div>
					</section>
				</motion.div>
			</div>

			<section aria-labelledby="charts-heading" className="flex flex-col gap-3">
				<h2 id="charts-heading" className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
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
