"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	ArrowLeftIcon,
	ArrowUpDownIcon,
	BookOpenIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	LayoutListIcon,
	LineChartIcon,
	ListFilterIcon,
	MinusIcon,
	RotateCcwIcon,
	SearchIcon,
	TrendingDownIcon,
	TrendingUpIcon,
} from "lucide-react";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { SubjectCoverageTimeline } from "@/components/student/subject-coverage-timeline";
import { cn } from "@/lib/utils";
import {
	buildSubjectCardTrackerStats,
	buildSubjectCoverageTimeline,
	type CoverageTimelinePoint,
	computeSummary,
	emptyCoverageTimelineFallback,
	emptySubjectCardTrackerStats,
	type EnrolledSubjectCard,
	type PerformanceRowSerialized,
	type SortMode,
	sortPerformanceRows,
	type SubjectCardTrackerStats,
	type TrackerStatus,
} from "@/lib/student/performance-matrix";
import { getSubjectCardIconConfig } from "@/lib/student/subject-lucide-icon";

export type StudentPerformanceViewProps = {
	initialRows: PerformanceRowSerialized[];
	loadError: string | null;
	subjectFromUrl?: string | null;
	enrolledSubjectCards: EnrolledSubjectCard[];
	profileGrade: number | null;
};

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

	return { container, item };
}

function usePageTransitionVariants() {
	const reduceMotion = useReducedMotion();
	return React.useMemo(() => {
		const durIn = reduceMotion ? 0 : 0.26;
		const durOut = reduceMotion ? 0 : 0.18;
		return {
			variants: {
				hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 10 },
				show: {
					opacity: 1,
					y: 0,
					transition: { duration: durIn, ease: "easeOut" as const },
				},
				exit: {
					opacity: reduceMotion ? 1 : 0,
					y: reduceMotion ? 0 : -8,
					transition: { duration: durOut, ease: "easeIn" as const },
				},
			},
		};
	}, [reduceMotion]);
}

function statusLabel(status: TrackerStatus): string {
	switch (status) {
		case "good":
			return "Good";
		case "satisfactory":
			return "Satisfactory";
		case "bad":
			return "Needs improvement";
		default:
			return "Not tested";
	}
}

function sortModeLabel(mode: SortMode): string {
	switch (mode) {
		case "curriculum":
			return "Curriculum order";
		case "last_test":
			return "Last test (recent first)";
		case "status":
			return "Status (priority)";
	}
}

function normalizeTopicSearchText(s: string): string {
	return s.trim().toLowerCase().normalize("NFKC");
}

/** Haystack should already be normalized (NFKC + lowercase). */
function haystackIncludesNormalized(haystack: string, needle: string): boolean {
	if (!needle) return true;
	return haystack.includes(needle);
}

function rowMatchesTopicSearch(row: PerformanceRowSerialized, rawQuery: string): boolean {
	const q = rawQuery.trim();
	if (!q) return true;

	const tokens = q
		.split(/\s+/)
		.map((t) => normalizeTopicSearchText(t))
		.filter(Boolean);
	if (tokens.length === 0) return true;

	const topic = normalizeTopicSearchText(row.topicName);
	const unit = normalizeTopicSearchText(row.unitName);
	const chapter = normalizeTopicSearchText(row.chapterName);
	const subject = normalizeTopicSearchText(row.subjectName);

	return tokens.every((token) => {
		if (
			haystackIncludesNormalized(topic, token) ||
			haystackIncludesNormalized(unit, token) ||
			haystackIncludesNormalized(chapter, token) ||
			haystackIncludesNormalized(subject, token)
		) {
			return true;
		}
		if (/^\d+$/.test(token)) {
			const n = Number.parseInt(token, 10);
			return row.unitNumber === n || row.chapterNumber === n || row.topicNumber === n;
		}
		return false;
	});
}

function emptyPerformanceMatrixMessage(
	searchQuery: string,
	statusFilter: TrackerStatus | "all",
): string {
	const q = searchQuery.trim();
	const hasStatus = statusFilter !== "all";
	if (q && hasStatus) {
		return "No topics match the current status filter and search. Try adjusting filters or use Reset filters.";
	}
	if (q) {
		return "No topics match your search. Try different words or use Reset filters.";
	}
	if (hasStatus) {
		return "No topics match these filters. Try clearing the status filter.";
	}
	return "No performance tracker rows for this subject yet. Rows are created when your curriculum is linked to your account; contact your teacher or admin if this stays empty.";
}

function statusBadgeVariant(
	status: TrackerStatus,
): "default" | "secondary" | "destructive" | "outline" {
	if (status === "good") return "default";
	if (status === "bad") return "destructive";
	if (status === "satisfactory") return "secondary";
	return "outline";
}

function performanceStatusBadgeClass(status: TrackerStatus): string {
	if (status === "not_tested") {
		return "h-6 border-transparent bg-muted px-2.5 text-[13px] font-medium text-muted-foreground";
	}
	return "h-6 px-2.5 text-[13px] font-semibold";
}

function trendIcon(row: PerformanceRowSerialized) {
	const common = "size-3.5 shrink-0";
	if (row.trend === "improving") {
		return <TrendingUpIcon className={cn(common, "text-primary")} aria-hidden />;
	}
	if (row.trend === "declining") {
		return <TrendingDownIcon className={cn(common, "text-destructive")} aria-hidden />;
	}
	return <MinusIcon className={cn(common, "text-muted-foreground")} aria-hidden />;
}

function trendLabel(t: PerformanceRowSerialized["trend"]): string {
	if (t === "improving") return "Improving";
	if (t === "declining") return "Declining";
	return "Stable";
}

function formatLastTest(iso: string | null): string {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
	} catch {
		return "—";
	}
}

function formatScore(n: number | null): string {
	if (n == null || Number.isNaN(n)) return "—";
	return `${Math.round(n)}%`;
}

function practiceHref(topicIds: string[], subjectId: string | null): string {
	if (!topicIds.length) return "/student/practice";
	const sp = new URLSearchParams();
	sp.set("topicIds", topicIds.join(","));
	if (subjectId) sp.set("subjectId", subjectId);
	return `/student/practice?${sp.toString()}`;
}

/** Surfaces for subject drill-down: distinct from page bg in light mode; hover matches subject grid tiles. */
const performanceDetailSurfaceClass =
	"border border-border bg-muted shadow-sm ring-0 transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-primary/50 hover:shadow-[0_0_28px_-8px_color-mix(in_oklab,var(--primary)_42%,transparent)] hover:bg-black/[0.035] dark:bg-card dark:shadow-none dark:hover:bg-muted/30";

const emptySubjectCardStats: SubjectCardTrackerStats = emptySubjectCardTrackerStats;

export function StudentPerformanceView({
	initialRows,
	loadError,
	subjectFromUrl = null,
	enrolledSubjectCards,
	profileGrade,
}: StudentPerformanceViewProps) {
	const { container, item } = useStaggerVariants();
	const { variants: pageVariants } = usePageTransitionVariants();
	const reduceMotion = useReducedMotion();
	const router = useRouter();

	const subjectOptions = React.useMemo(
		() =>
			enrolledSubjectCards.map((c) => ({
				id: c.subjectId,
				name: c.subjectName,
				subjectGroup: null as string | null,
				sortOrder: c.sortOrder,
			})),
		[enrolledSubjectCards],
	);

	const detailSubjectId = React.useMemo(() => {
		if (!subjectFromUrl) return null;
		return enrolledSubjectCards.some((c) => c.subjectId === subjectFromUrl) ? subjectFromUrl : null;
	}, [subjectFromUrl, enrolledSubjectCards]);

	const detailSubjectName = React.useMemo(() => {
		if (!detailSubjectId) return null;
		return enrolledSubjectCards.find((c) => c.subjectId === detailSubjectId)?.subjectName ?? null;
	}, [detailSubjectId, enrolledSubjectCards]);

	const [statusFilter, setStatusFilter] = React.useState<TrackerStatus | "all">("all");
	const [sortMode, setSortMode] = React.useState<SortMode>("curriculum");
	const [topicSearch, setTopicSearch] = React.useState("");
	const [selectedTopicIds, setSelectedTopicIds] = React.useState<Set<string>>(() => new Set());
	const [sheetRow, setSheetRow] = React.useState<PerformanceRowSerialized | null>(null);
	const [sheetOpen, setSheetOpen] = React.useState(false);
	const [summaryOpen, setSummaryOpen] = React.useState(true);

	const navigateSubject = React.useCallback(
		(id: string) => {
			if (id === "all") {
				router.replace("/student/performance", { scroll: false });
			} else {
				router.replace(`/student/performance?subject=${encodeURIComponent(id)}`, { scroll: false });
			}
		},
		[router],
	);

	const subjectTrackerStats = React.useMemo(
		() => buildSubjectCardTrackerStats(initialRows),
		[initialRows],
	);

	const coverageTimelineBySubjectId = React.useMemo(() => {
		const m = new Map<string, CoverageTimelinePoint[]>();
		for (const c of enrolledSubjectCards) {
			m.set(c.subjectId, buildSubjectCoverageTimeline(c.subjectId, c.topicTotal, initialRows));
		}
		return m;
	}, [enrolledSubjectCards, initialRows]);

	const filteredRows = React.useMemo(() => {
		let r = initialRows;
		if (detailSubjectId) {
			r = r.filter((row) => row.subjectId === detailSubjectId);
		}
		if (statusFilter !== "all") {
			r = r.filter((row) => row.status === statusFilter);
		}
		r = r.filter((row) => rowMatchesTopicSearch(row, topicSearch));
		return sortPerformanceRows(r, sortMode);
	}, [initialRows, detailSubjectId, statusFilter, sortMode, topicSearch]);

	const summary = React.useMemo(() => computeSummary(filteredRows), [filteredRows]);

	const hasActiveLocalFilters =
		statusFilter !== "all" || sortMode !== "curriculum" || topicSearch.trim().length > 0;

	const resetLocalFilters = React.useCallback(() => {
		setStatusFilter("all");
		setSortMode("curriculum");
		setTopicSearch("");
	}, []);

	const matrixPresenceKey = React.useMemo(
		() =>
			`${filteredRows.length === 0 ? "empty" : "matrix"}-${statusFilter}-${sortMode}-${topicSearch}-${filteredRows.length}`,
		[filteredRows.length, statusFilter, sortMode, topicSearch],
	);

	const toggleTopic = (topicId: string, checked: boolean) => {
		setSelectedTopicIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(topicId);
			else next.delete(topicId);
			return next;
		});
	};

	const openSheet = (row: PerformanceRowSerialized) => {
		setSheetRow(row);
		setSheetOpen(true);
	};

	const selectedList = React.useMemo(() => [...selectedTopicIds], [selectedTopicIds]);

	if (loadError) {
		return (
			<div className="p-6">
				<h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">Performance</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Topic mastery and your performance tracker.
				</p>
				<Alert variant="destructive" className="mt-6">
					<AlertTitle>Could not load tracker</AlertTitle>
					<AlertDescription>{loadError}</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (!loadError && enrolledSubjectCards.length === 0) {
		return (
			<div className="p-6">
				<h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">Performance</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Topic mastery and your performance tracker.
				</p>
				<Card className="mt-8 border-border shadow-none">
					<CardHeader>
						<CardTitle className="text-base">No subjects on your profile yet</CardTitle>
						<CardDescription>
							{profileGrade == null
								? "Set your grade (and stream or elective for grades 11–12) in settings so we can load the subjects you study."
								: "No subjects matched your grade and stream. Check that school-managed fields in settings are correct so your subject list matches your enrollment."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button render={<Link href="/student/settings" />}>Open settings</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-8 p-6 pb-28">
			<AnimatePresence mode="wait" initial={false}>
				{!detailSubjectId ? (
					<motion.div
						key="perf-subject-list"
						className="flex flex-col gap-8"
						initial="hidden"
						animate="show"
						exit="exit"
						variants={pageVariants}
					>
					<motion.div
						className="flex flex-col gap-1"
						initial="hidden"
						animate="show"
						variants={container}
					>
						<motion.h1
							className="font-semibold text-3xl text-foreground tracking-tight sm:text-4xl"
							variants={item}
						>
							Performance
						</motion.h1>
						<motion.p className="text-muted-foreground text-sm" variants={item}>
							Choose a subject to open your topic matrix, filters, and practice shortcuts.
						</motion.p>
					</motion.div>

					<section aria-labelledby="perf-subjects-heading" className="flex flex-col gap-3">
						<h2
							id="perf-subjects-heading"
							className="font-mono text-muted-foreground text-sm uppercase tracking-wider"
						>
							Your subjects
						</h2>
						<motion.div
							className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
							initial="hidden"
							animate="show"
							variants={container}
						>
							{enrolledSubjectCards.map((s) => {
								const { Icon, iconClassName } = getSubjectCardIconConfig(s.subjectName);
								const st = subjectTrackerStats.get(s.subjectId) ?? emptySubjectCardStats;
								const hasTopics = s.topicTotal > 0;
								const hasTrackerRows = st.trackedCount > 0;
								return (
									<motion.div key={s.subjectId} variants={item}>
										<motion.div
											className="h-full"
											whileHover={reduceMotion ? undefined : { scale: 1.012 }}
											whileTap={reduceMotion ? undefined : { scale: 0.988 }}
											transition={{ type: "spring", stiffness: 420, damping: 26 }}
										>
											<Link
												href={`/student/performance?subject=${encodeURIComponent(s.subjectId)}#perf-topic-matrix`}
												scroll
												aria-label={`Open ${s.subjectName} performance`}
												className={cn(
													"group flex h-full min-h-0 flex-col rounded-xl border p-4 text-left sm:p-5",
													"border-border bg-muted shadow-sm transition-[border-color,box-shadow,background-color] duration-200 ease-out",
													"hover:border-primary/50 hover:shadow-[0_0_28px_-8px_color-mix(in_oklab,var(--primary)_42%,transparent)]",
													"hover:bg-black/[0.035] dark:bg-card dark:shadow-none dark:hover:bg-muted/30",
													"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
												)}
											>
												<div className="flex items-start justify-between gap-2.5">
													<p className="min-w-0 flex-1 font-semibold text-foreground text-sm leading-snug sm:text-base">
														{s.subjectName}
													</p>
													<ChevronRightIcon
														className="size-4 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
														aria-hidden
													/>
												</div>

												<div className="mt-3 flex flex-1 flex-col gap-3">
													{!hasTopics ? (
														<p className="text-sm leading-snug text-muted-foreground">
															No topics in the catalog for this grade yet. Your teacher or admin may
															still be linking the curriculum.
														</p>
													) : !hasTrackerRows ? (
														<p className="text-sm leading-snug text-muted-foreground">
															Tracker rows appear when your curriculum is linked. Open the subject for your
															topic list.
														</p>
													) : (
														<>
															<div className="flex items-end justify-between gap-3">
																<div className="min-w-0 space-y-1">
																	<p className="font-semibold text-2xl tabular-nums tracking-tight text-foreground sm:text-3xl">
																		{s.percentCovered}
																		<span className="text-muted-foreground text-base font-semibold sm:text-lg">
																			%
																		</span>
																	</p>
																	<p className="text-muted-foreground text-[11px] leading-snug sm:text-xs">
																		Percent of this subject&apos;s topics you&apos;ve practiced at least
																		once.
																	</p>
																	<p className="text-muted-foreground text-sm leading-snug">
																		<span className="font-semibold tabular-nums text-foreground">
																			{s.attemptedCount}
																		</span>
																		<span> of </span>
																		<span className="font-semibold tabular-nums text-foreground">
																			{s.topicTotal}
																		</span>
																		<span> topics attempted</span>
																	</p>
																</div>
																<Icon
																	className={cn(
																		"size-10 shrink-0 sm:size-11",
																		iconClassName,
																	)}
																	strokeWidth={1.25}
																	aria-hidden
																/>
															</div>
															<SubjectCoverageTimeline
																points={
																	coverageTimelineBySubjectId.get(s.subjectId) ??
																	emptyCoverageTimelineFallback
																}
																className="-mx-0.5"
															/>
															{st.lastTestDate || st.testsTakenTotal > 0 ? (
																<p className="text-[12.375px] leading-snug text-muted-foreground sm:text-xs">
																	{[
																		st.lastTestDate
																			? `Last test ${formatLastTest(st.lastTestDate)}`
																			: null,
																		st.testsTakenTotal > 0
																			? `${st.testsTakenTotal} test${st.testsTakenTotal === 1 ? "" : "s"}`
																			: null,
																	]
																		.filter(Boolean)
																		.join(" · ")}
																</p>
															) : null}
														</>
													)}
												</div>
											</Link>
										</motion.div>
									</motion.div>
								);
							})}
						</motion.div>
						<p className="text-muted-foreground text-xs leading-relaxed">
							Coverage is the share of curriculum topics you have tried at least once. The chart uses
							each topic&apos;s last activity date (an estimate until first-attempt history exists).
							Open a subject for mastery breakdown by topic.
						</p>
					</section>
					</motion.div>
				) : (
					<motion.div
						key="perf-subject-detail"
						className="flex flex-col gap-4"
						initial="hidden"
						animate="show"
						exit="exit"
						variants={pageVariants}
					>
					<header className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="w-fit gap-1.5 self-start text-muted-foreground"
							onClick={() => navigateSubject("all")}
						>
							<ArrowLeftIcon className="size-4" aria-hidden />
							All subjects
						</Button>
						{detailSubjectName ? (
							<h1 className="min-w-0 font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
								{detailSubjectName}
							</h1>
						) : null}
					</header>

					<motion.section
						aria-labelledby="perf-summary-heading"
						className="flex flex-col gap-3"
						initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut", delay: 0 }}
					>
						<Collapsible
							open={summaryOpen}
							onOpenChange={setSummaryOpen}
							className="flex flex-col gap-3"
						>
							<h2 id="perf-summary-heading" className="sr-only">
								Summary
							</h2>
							<CollapsibleTrigger
								type="button"
								aria-labelledby="perf-summary-heading"
								className={cn(
									"group flex w-full items-center justify-start gap-2 rounded-md py-1 text-left outline-none",
									"-mx-1 px-1 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								)}
							>
								<span
									className="font-mono text-muted-foreground text-sm uppercase tracking-wider"
									aria-hidden
								>
									Summary
								</span>
								<ChevronDownIcon
									className={cn(
										"size-4 shrink-0 text-muted-foreground transition-transform duration-200",
										summaryOpen ? "rotate-0" : "-rotate-90",
									)}
									aria-hidden
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="overflow-hidden">
								<motion.div
									className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
									initial="hidden"
									animate="show"
									variants={container}
								>
									{(
										[
											["Total topics", summary.total, LayoutListIcon],
											["Mastered", summary.good, LineChartIcon],
											["Satisfactory", summary.satisfactory, ListFilterIcon],
											["Needs improvement", summary.bad, TrendingDownIcon],
											["Not tested", summary.not_tested, BookOpenIcon],
										] as const
									).map(([label, value, Icon]) => (
										<motion.div key={label} variants={item}>
											<Card className={performanceDetailSurfaceClass}>
												<CardHeader className="flex flex-row items-center justify-between pb-2">
													<CardTitle className="font-medium text-sm">{label}</CardTitle>
													<Icon className="text-primary/80" aria-hidden />
												</CardHeader>
												<CardContent>
													<motion.p
														key={value}
														className="font-semibold text-2xl tabular-nums"
														initial={reduceMotion ? false : { opacity: 0.75, y: 4 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
													>
														{value}
													</motion.p>
													<p className="text-muted-foreground text-xs">In current filters</p>
												</CardContent>
											</Card>
										</motion.div>
									))}
								</motion.div>
							</CollapsibleContent>
						</Collapsible>
					</motion.section>

					<motion.section
						aria-labelledby="perf-filters-heading"
						className="flex flex-col gap-1.5"
						initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut", delay: reduceMotion ? 0 : 0.06 }}
					>
						<h2
							id="perf-filters-heading"
							className="font-mono text-muted-foreground text-sm uppercase tracking-wider"
						>
							Filters and sort
						</h2>
						<Card className={performanceDetailSurfaceClass} size="sm">
							<CardContent className="flex flex-col gap-2 py-3">
								<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
									<p className="text-muted-foreground text-sm tabular-nums">
										<span className="font-medium text-foreground">{filteredRows.length}</span>
										{filteredRows.length === 1 ? " topic" : " topics"}
										{topicSearch.trim() ? " matching search" : ""}
									</p>
									<div className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[20rem] sm:flex-none sm:flex-row sm:items-center sm:justify-end sm:gap-2 lg:min-w-[28rem]">
										<div className="relative min-w-0 flex-1 sm:min-w-[16rem]">
											<label htmlFor="perf-topic-search" className="sr-only">
												Search topics by name, unit, or chapter
											</label>
											<SearchIcon
												className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
												aria-hidden
											/>
											<Input
												id="perf-topic-search"
												type="search"
												placeholder="Search topics, units, chapters…"
												value={topicSearch}
												onChange={(e) => setTopicSearch(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Escape") {
														e.preventDefault();
														setTopicSearch("");
													}
												}}
												className="h-8 border-border bg-background ps-8 dark:bg-input/30"
												autoComplete="off"
												enterKeyHint="search"
											/>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="shrink-0 text-muted-foreground"
											disabled={!hasActiveLocalFilters}
											onClick={resetLocalFilters}
										>
											<RotateCcwIcon className="size-3.5" aria-hidden />
											Reset filters
										</Button>
									</div>
								</div>

								<div
									className="flex flex-col gap-1.5 border-border border-t pt-2"
									role="toolbar"
									aria-label="Filter and sort topics"
								>
									<span className="text-muted-foreground text-xs">Filters</span>
									<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
										<div className="flex min-w-0 flex-wrap items-center gap-2">
											<DropdownMenu>
												<DropdownMenuTrigger
													render={
														<Button
															variant="outline"
															size="sm"
															className="h-8 min-w-[12rem] shrink-0 justify-start gap-1.5 rounded-full border-border px-3 font-normal shadow-none sm:w-56 sm:max-w-[min(100%,18rem)]"
														/>
													}
												>
													<BookOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
													<span className="min-w-0 flex-1 truncate text-left">
														{detailSubjectId
															? (detailSubjectName ?? "Subject")
															: "All subjects"}
													</span>
													<ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
												</DropdownMenuTrigger>
												<DropdownMenuContent className="min-w-52" align="start">
													<DropdownMenuGroup>
														<DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
															Subject
														</DropdownMenuLabel>
														<DropdownMenuRadioGroup
															value={detailSubjectId ?? "all"}
															onValueChange={(v) => navigateSubject(String(v))}
														>
															<DropdownMenuRadioItem value="all">
																All subjects
															</DropdownMenuRadioItem>
															{subjectOptions.map((o) => (
																<DropdownMenuRadioItem key={o.id} value={o.id}>
																	{o.name}
																</DropdownMenuRadioItem>
															))}
														</DropdownMenuRadioGroup>
													</DropdownMenuGroup>
												</DropdownMenuContent>
											</DropdownMenu>

											<DropdownMenu>
												<DropdownMenuTrigger
													render={
														<Button
															variant="outline"
															size="sm"
															className="h-8 min-w-[12rem] shrink-0 justify-start gap-1.5 rounded-full border-border px-3 font-normal shadow-none sm:w-56 sm:max-w-[min(100%,18rem)]"
														/>
													}
												>
													<ArrowUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
													<span className="min-w-0 flex-1 truncate text-left">
														{sortModeLabel(sortMode)}
													</span>
													<ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
												</DropdownMenuTrigger>
												<DropdownMenuContent className="min-w-56" align="start">
													<DropdownMenuGroup>
														<DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
															Sort
														</DropdownMenuLabel>
														<DropdownMenuRadioGroup
															value={sortMode}
															onValueChange={(v) => setSortMode(v as SortMode)}
														>
															<DropdownMenuRadioItem value="curriculum">
																Curriculum order
															</DropdownMenuRadioItem>
															<DropdownMenuRadioItem value="last_test">
																Last test (recent first)
															</DropdownMenuRadioItem>
															<DropdownMenuRadioItem value="status">
																Status (priority)
															</DropdownMenuRadioItem>
														</DropdownMenuRadioGroup>
													</DropdownMenuGroup>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>

										<div className="min-w-0 flex-1">
											<span className="sr-only">Filter by performance status</span>
											<div
												className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]"
												role="group"
												aria-label="Filter by performance status"
											>
												{(["all", "good", "satisfactory", "bad", "not_tested"] as const).map((s) => {
													const active = statusFilter === s;
													const label =
														s === "all"
															? "All"
															: s === "not_tested"
																? "Not tested"
																: statusLabel(s);
													return (
														<Button
															key={s}
															type="button"
															size="xs"
															variant={active ? "default" : "outline"}
															className={cn(
																"shrink-0 rounded-full",
																!active && "border-border bg-background shadow-none",
															)}
															aria-pressed={active}
															onClick={() => setStatusFilter(s)}
														>
															{label}
														</Button>
													);
												})}
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</motion.section>

					<motion.section
						id="perf-topic-matrix"
						aria-labelledby="perf-matrix-heading"
						className="flex scroll-mt-24 flex-col gap-1.5"
						initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut", delay: reduceMotion ? 0 : 0.12 }}
					>
						<h2
							id="perf-matrix-heading"
							className="font-mono text-muted-foreground text-sm uppercase tracking-wider"
						>
							Topics in this subject
						</h2>
						<p className="text-muted-foreground text-xs leading-snug sm:text-sm">
							Each row is one topic in syllabus order (default sort). Chapter number and name are shown
							side by side; focus on status and how many tests you&apos;ve taken.
						</p>
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={matrixPresenceKey}
								initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -4 }}
								transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
							>
								{filteredRows.length === 0 ? (
									<Card className={performanceDetailSurfaceClass}>
										<CardContent className="py-10 text-center text-muted-foreground text-sm">
											{emptyPerformanceMatrixMessage(topicSearch, statusFilter)}
										</CardContent>
									</Card>
								) : (
									<Card
										className={cn(performanceDetailSurfaceClass, "overflow-hidden rounded-xl py-0")}
										size="sm"
									>
										<CardContent className="p-0">
											<div
												className={cn(
													"max-h-[min(40rem,calc(100dvh-13rem))] overflow-auto rounded-xl border border-border/90 bg-background shadow-sm",
													"[scrollbar-gutter:stable]",
												)}
											>
												<table className="w-full min-w-[52rem] border-separate border-spacing-0 text-sm">
													<caption className="sr-only">
														Performance by topic for {detailSubjectName ?? "this subject"}. One row per topic; order
														follows your sort choice (default curriculum order matches the full syllabus sequence).
													</caption>
													<thead>
														<tr
															className={cn(
																"sticky top-0 z-10 border-border border-b",
																"bg-muted/95 shadow-[0_1px_0_0_var(--border)] backdrop-blur-sm dark:bg-muted/90",
															)}
														>
															<th
																scope="col"
																className="w-11 border-border border-e px-2 py-2 text-center align-middle font-medium text-muted-foreground text-xs"
															>
																<span className="sr-only">Select for practice</span>
															</th>
															<th
																scope="col"
																className="min-w-[11rem] border-border border-e px-3 py-2 text-start align-middle font-medium text-foreground text-xs"
															>
																Topic
															</th>
															<th
																scope="col"
																className="min-w-[9rem] border-border border-e px-2 py-2 text-start align-middle font-medium text-muted-foreground/90 text-xs"
															>
																Chapter
															</th>
															<th
																scope="col"
																className="min-w-[4rem] border-border border-e px-2 py-2 text-center align-middle font-medium text-muted-foreground/90 text-xs"
															>
																Topic #
															</th>
															<th
																scope="col"
																className="min-w-[10rem] border-border border-e px-3 py-2 text-center align-middle font-medium text-foreground text-xs"
															>
																Performance
															</th>
															<th
																scope="col"
																className="min-w-[5.5rem] border-border border-e px-3 py-2 text-center align-middle font-medium text-foreground text-xs"
															>
																Tests taken
															</th>
															<th
																scope="col"
																className="min-w-[7rem] border-border border-e px-3 py-2 text-center align-middle font-medium text-muted-foreground text-xs"
															>
																Last test
															</th>
															<th
																scope="col"
																className="min-w-[6rem] px-3 py-2 text-center align-middle font-medium text-muted-foreground text-xs"
															>
																Trend
															</th>
														</tr>
													</thead>
													<tbody>
														{filteredRows.map((row) => {
															const checked = selectedTopicIds.has(row.topicId);
															return (
																<tr
																	key={row.trackerId}
																	className={cn(
																		"cursor-pointer border-border border-b bg-background last:border-b-0",
																		"hover:bg-muted/25 transition-colors",
																	)}
																	onClick={() => openSheet(row)}
																	onKeyDown={(e) => {
																		if (e.key === "Enter" || e.key === " ") {
																			e.preventDefault();
																			openSheet(row);
																		}
																	}}
																	tabIndex={0}
																	title={`${row.subjectName} — ${statusLabel(row.status)}. Average ${formatScore(row.averageScore)}, ${row.testsTaken} tests taken.`}
																>
																	<td className="border-border border-e px-2 py-2 align-middle text-center">
																		<input
																			type="checkbox"
																			checked={checked}
																			aria-label={`Select ${row.topicName}`}
																			className={cn(
																				"size-3.5 rounded border-input accent-primary",
																				"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
																			)}
																			onClick={(e) => e.stopPropagation()}
																			onChange={(e) => toggleTopic(row.topicId, e.target.checked)}
																		/>
																	</td>
																	<th
																		scope="row"
																		className="max-w-[18rem] border-border border-e px-3 py-2 text-start align-middle text-[15px] text-foreground leading-snug font-medium"
																	>
																		{row.topicName}
																	</th>
																	<td className="border-border border-e px-2 py-2 align-middle">
																		<div
																			className="flex max-w-[14rem] flex-wrap items-baseline gap-x-2 gap-y-0.5"
																			title={`Chapter ${row.chapterNumber}: ${row.chapterName}`}
																		>
																			<span className="shrink-0 tabular-nums text-muted-foreground/85 text-xs">
																				{row.chapterNumber}
																			</span>
																			<span className="min-w-0 truncate text-[11px] leading-snug text-muted-foreground/55">
																				{row.chapterName}
																			</span>
																		</div>
																	</td>
																	<td className="border-border border-e px-2 py-2 align-middle text-center tabular-nums text-muted-foreground/80 text-xs">
																		{row.topicNumber}
																	</td>
																	<td className="border-border border-e px-3 py-2 align-middle">
																		<div className="flex justify-center">
																			<Badge
																				variant={statusBadgeVariant(row.status)}
																				className={performanceStatusBadgeClass(row.status)}
																			>
																				{statusLabel(row.status)}
																			</Badge>
																		</div>
																	</td>
																	<td className="border-border border-e px-3 py-2 align-middle">
																		<div className="flex flex-col items-center gap-0.5">
																			<span className="font-semibold text-foreground text-xl tabular-nums tracking-tight leading-none">
																				{row.testsTaken}
																			</span>
																			<span className="text-[11px] text-muted-foreground leading-tight">
																				{row.testsTaken === 1 ? "test" : "tests"}
																			</span>
																		</div>
																	</td>
																	<td className="border-border border-e px-3 py-2 align-middle text-center font-mono text-muted-foreground text-xs tabular-nums">
																		{formatLastTest(row.lastTestDate)}
																	</td>
																	<td className="px-3 py-2 text-center align-middle text-muted-foreground text-xs">
																		— {trendLabel(row.trend)}
																	</td>
																</tr>
															);
														})}
													</tbody>
												</table>
											</div>
										</CardContent>
									</Card>
								)}							</motion.div>
						</AnimatePresence>
					</motion.section>
					</motion.div>
				)}
			</AnimatePresence>

			{detailSubjectId && selectedList.length > 0 ? (
				<div
					className={cn(
						"fixed z-40 flex max-w-[calc(100vw-2rem)] items-center gap-4 rounded-xl border border-border",
						"bg-card px-4 py-3 shadow-lg",
						"bottom-6 left-1/2 -translate-x-1/2",
					)}
				>
					<p className="text-sm">
						<span className="font-mono tabular-nums">{selectedList.length}</span> topic
						{selectedList.length === 1 ? "" : "s"} selected
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => setSelectedTopicIds(new Set())}
						>
							Clear
						</Button>
						<Button size="sm" render={<Link href={practiceHref(selectedList, detailSubjectId)} />}>
							Start practice
						</Button>
					</div>
				</div>
			) : null}

			{detailSubjectId ? (
				<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
					<SheetContent side="right" className="sm:max-w-md">
						{sheetRow ? (
							<>
								<SheetHeader>
									<SheetTitle className="text-pretty">{sheetRow.topicName}</SheetTitle>
									<SheetDescription>
										{sheetRow.subjectName} · Unit {sheetRow.unitNumber}: {sheetRow.unitName} ·{" "}
										{sheetRow.chapterName}
									</SheetDescription>
								</SheetHeader>
								<div className="flex flex-col gap-4 px-4">
									<div className="grid grid-cols-2 gap-3">
										<div className="rounded-lg border border-border bg-muted/25 px-3 py-3">
											<p className="text-muted-foreground text-xs">Performance</p>
											<Badge
												variant={statusBadgeVariant(sheetRow.status)}
												className={cn("mt-2", performanceStatusBadgeClass(sheetRow.status))}
											>
												{statusLabel(sheetRow.status)}
											</Badge>
										</div>
										<div className="rounded-lg border border-border bg-muted/25 px-3 py-3">
											<p className="text-muted-foreground text-xs">Tests taken</p>
											<p className="mt-1 font-semibold text-2xl text-foreground tabular-nums tracking-tight">
												{sheetRow.testsTaken}
											</p>
											<p className="text-[11px] text-muted-foreground leading-tight">
												{sheetRow.testsTaken === 1 ? "test so far" : "tests so far"}
											</p>
										</div>
									</div>
									<p className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
										{trendIcon(sheetRow)}
										<span>
											Trend: <span className="text-foreground">{trendLabel(sheetRow.trend)}</span>
										</span>
									</p>
									<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
										<dt className="text-muted-foreground">Average score</dt>
										<dd className="font-mono tabular-nums">{formatScore(sheetRow.averageScore)}</dd>
										<dt className="text-muted-foreground">Last test</dt>
										<dd className="font-mono tabular-nums text-xs">
											{formatLastTest(sheetRow.lastTestDate)}
										</dd>
									</dl>
									<p className="text-muted-foreground text-xs leading-relaxed">
										Test history charts and suggested resources will appear here as those features
										ship.
									</p>
								</div>
								<SheetFooter className="sm:flex-row">
									<Button
										className="w-full sm:w-auto"
										render={<Link href={practiceHref([sheetRow.topicId], sheetRow.subjectId)} />}
									>
										Practice this topic
									</Button>
								</SheetFooter>
							</>
						) : null}
					</SheetContent>
				</Sheet>
			) : null}
		</div>
	);
}
