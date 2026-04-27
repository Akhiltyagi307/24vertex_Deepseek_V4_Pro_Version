"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	ArrowDownUp,
	ArrowLeftIcon,
	BookOpenIcon,
	ChevronDownIcon,
	LayoutListIcon,
	LineChartIcon,
	ListFilter,
	ListFilterIcon,
	ListOrdered,
	MinusIcon,
	RotateCcwIcon,
	TrendingDownIcon,
	TrendingUpIcon,
} from "lucide-react";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
	PageHeaderSubtext,
	pageHeaderSubtextScrollClass,
	pageHeaderSubtextTextClass,
} from "@/components/student/page-header-subtext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	SubjectCard,
	subjectStatusLabelToDashboardStatus,
} from "@/components/student/dashboard-subject-card";
import { cn } from "@/lib/utils";
import {
	averageTestScorePercentForSubject,
	buildSubjectCardTrackerStats,
	dominantStatusFromTrackerStats,
	computeSummary,
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
/** Extra surface styles on top of default `Card` (already uses `cardSurfaceFrameClassName`). */
const performanceDetailSurfaceClass = cn(
	"bg-muted shadow-sm transition-[border-color,box-shadow,background-color] duration-200 ease-out",
	"hover:border-primary/50 hover:shadow-[0_0_28px_-8px_color-mix(in_oklab,var(--primary)_42%,transparent)]",
	"hover:bg-black/[0.035] dark:bg-card dark:shadow-none dark:hover:bg-muted/30",
);

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

	const activePerformanceFilterCount = statusFilter !== "all" ? 1 : 0;
	const performanceSortIsNonDefault = sortMode !== "curriculum";

	const [perfMatrixFiltersOpen, setPerfMatrixFiltersOpen] = React.useState(false);
	const [perfMatrixSortOpen, setPerfMatrixSortOpen] = React.useState(false);

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
				<div className="flex flex-col gap-1.5">
					<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">Performance</h1>
					<PageHeaderSubtext>
						We couldn’t load your performance tracker this time — try again shortly.
					</PageHeaderSubtext>
				</div>
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
				<div className="flex flex-col gap-1.5">
					<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">Performance</h1>
					<PageHeaderSubtext>
						Open Profile to add your class details, then return here to open a subject and see topic-by-topic strength.
					</PageHeaderSubtext>
				</div>
				<Card className="mt-8 border-border shadow-none">
					<CardHeader>
						<CardTitle className="text-base">No subjects to show yet</CardTitle>
						<CardDescription>
							{profileGrade == null
								? "Add your grade (and stream or elective for 11–12) in Profile so we can load the right subjects."
								: "Nothing matched your grade and stream. Open Profile and check grade, stream, and elective, or ask your school to confirm your enrollment."}
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
						className="flex shrink-0 flex-col gap-1.5"
						initial="hidden"
						animate="show"
						variants={container}
					>
						<motion.h1
							className="font-semibold text-3xl tracking-tight text-balance text-foreground"
							variants={item}
						>
							Performance
						</motion.h1>
						<motion.div className={pageHeaderSubtextScrollClass} variants={item}>
							<p className={pageHeaderSubtextTextClass}>
								Pick a subject to see your topic grid, filter weak areas, and jump back into practice.
							</p>
						</motion.div>
					</motion.div>

					<section aria-labelledby="perf-subjects-heading" className="flex flex-col gap-3">
						<h2
							id="perf-subjects-heading"
							className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground"
						>
							Open a subject
						</h2>
						<motion.div
							className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
							initial="hidden"
							animate="show"
							variants={container}
						>
							{enrolledSubjectCards.map((s) => {
								const { Icon, iconClassName, shellClassName } = getSubjectCardIconConfig(
									s.subjectName,
								);
								const st = subjectTrackerStats.get(s.subjectId) ?? emptySubjectCardStats;
								const hasTopics = s.topicTotal > 0;
								const hasTrackerRows = st.trackedCount > 0;
								const hasAttempts = s.attemptedCount > 0;
								const lastLabel = st.lastTestDate ? formatLastTest(st.lastTestDate) : "";
								const href = `/student/performance?subject=${encodeURIComponent(s.subjectId)}#perf-topic-matrix`;
								const cardStatus = subjectStatusLabelToDashboardStatus(
									dominantStatusFromTrackerStats(st),
								);
								const avgScore = averageTestScorePercentForSubject(initialRows, s.subjectId) ?? 0;

								const iconEl = (
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

								if (!hasTopics) {
									return (
										<motion.div key={s.subjectId} className="min-h-0" variants={item}>
											<Link
												href={href}
												scroll
												aria-label={`Open ${s.subjectName} performance`}
												className={cn(
													"block h-full min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
												)}
											>
												<SubjectCard
													subject={s.subjectName}
													lastTestDate=""
													subtitle="No topics in the catalog for this grade yet. Your teacher or admin may still be linking the curriculum."
													topicsAttempted={0}
													topicsTotal={0}
													testsTaken={0}
													avgScore={0}
													status="in_progress"
													showCta={false}
													metricsIconSlot={iconEl}
												/>
											</Link>
										</motion.div>
									);
								}

								if (!hasTrackerRows) {
									return (
										<motion.div key={s.subjectId} className="min-h-0" variants={item}>
											<Link
												href={href}
												scroll
												aria-label={`Open ${s.subjectName} performance`}
												className={cn(
													"block h-full min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
												)}
											>
												<SubjectCard
													subject={s.subjectName}
													lastTestDate=""
													subtitle="Tracker rows appear when your curriculum is linked. Open the subject for your topic list."
													topicsAttempted={0}
													topicsTotal={s.topicTotal}
													testsTaken={0}
													avgScore={0}
													status="in_progress"
													showCta={false}
													metricsIconSlot={iconEl}
												/>
											</Link>
										</motion.div>
									);
								}

								return (
									<motion.div key={s.subjectId} className="min-h-0" variants={item}>
										<Link
											href={href}
											scroll
											aria-label={`Open ${s.subjectName} performance`}
											className={cn(
												"block h-full min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
											)}
										>
											<SubjectCard
												subject={s.subjectName}
												lastTestDate={hasAttempts ? lastLabel : ""}
												subtitle={
													!hasAttempts
														? st.lastTestDate
															? `Last test · ${lastLabel}`
															: "No tests recorded yet"
														: undefined
												}
												topicsAttempted={s.attemptedCount}
												topicsTotal={s.topicTotal}
												testsTaken={st.testsTakenTotal}
												avgScore={hasAttempts ? avgScore : 0}
												status={!hasAttempts ? "in_progress" : cardStatus}
												showCta={false}
												metricsIconSlot={iconEl}
											/>
										</Link>
									</motion.div>
								);
							})}
						</motion.div>
						<p className="text-muted-foreground text-xs leading-relaxed">
							Coverage is the share of curriculum topics you have tried at least once. Open a subject for
							mastery breakdown by topic.
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
					<header className="flex flex-col gap-1.5">
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
							<h1 className="min-w-0 font-semibold text-3xl tracking-tight text-balance text-foreground">
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
						id="perf-topic-matrix"
						aria-labelledby="perf-matrix-heading"
						className="flex scroll-mt-24 flex-col gap-2"
						initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut", delay: reduceMotion ? 0 : 0.08 }}
					>
						<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<h2
								id="perf-matrix-heading"
								className="m-0 font-mono text-muted-foreground text-xs uppercase tracking-wider"
							>
								Topics in this subject
							</h2>
							<p className="m-0 shrink-0 text-muted-foreground text-xs">
								<span className="font-medium tabular-nums text-foreground">{filteredRows.length}</span>
								{filteredRows.length === 1 ? " topic" : " topics"}
								{topicSearch.trim() ? " matching search" : ""}
							</p>
						</div>

						<Card
							className={cn(performanceDetailSurfaceClass, "overflow-hidden gap-0 p-0 py-0 shadow-none")}
							size="sm"
						>
							{/* Tight vertical padding: Search/Filter band should sit close to the title row and table rule. */}
							<div className="px-4 py-3 sm:px-5 sm:py-3.5">
								<div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6 lg:gap-8">
									<div className="flex min-w-0 flex-1 flex-col gap-3">
										<Label htmlFor="perf-topic-search" className="text-foreground text-sm font-medium">
											Search
										</Label>
										<p className="m-0 text-muted-foreground text-xs leading-relaxed">
											Search <span className="font-medium text-foreground">topic names</span> and{" "}
											<span className="font-medium text-foreground">unit or chapter</span> labels in
											the list.
										</p>
										<div className="flex min-w-0 flex-col gap-2">
											<Input
												id="perf-topic-search"
												type="search"
												placeholder="e.g. Algebra, English, Unit 3…"
												value={topicSearch}
												onChange={(e) => setTopicSearch(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Escape") {
														e.preventDefault();
														setTopicSearch("");
													}
												}}
												className="box-border h-8 w-full min-w-0 max-w-md border-border bg-background dark:bg-input/30"
												autoComplete="off"
												enterKeyHint="search"
											/>
											{hasActiveLocalFilters ? (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-8 w-fit shrink-0 gap-1.5 px-0 text-muted-foreground hover:text-foreground"
													onClick={resetLocalFilters}
												>
													<RotateCcwIcon className="size-3.5" aria-hidden />
													Reset filters
												</Button>
											) : null}
										</div>
									</div>

									<div
										className="flex min-w-0 flex-1 flex-col gap-3 border-border border-t pt-5 md:min-w-0 md:border-t-0 md:border-l md:pt-0 md:pl-8"
										role="toolbar"
										aria-label="Filter and sort topics"
									>
										<p className="m-0 text-foreground text-sm font-medium leading-none">
											Filter and Sort
										</p>
										<p className="m-0 text-muted-foreground text-xs leading-relaxed">
											<span className="font-medium text-foreground">Filters</span> and{" "}
											<span className="font-medium text-foreground">Sort</span> open as floating
											panels over the page. Opening one closes the other.
										</p>
										<div className="flex w-full min-w-0 gap-3">
											<div className="flex min-w-0 flex-1 basis-0">
												<Popover
													open={perfMatrixFiltersOpen}
													onOpenChange={(open) => {
														setPerfMatrixFiltersOpen(open);
														if (open) setPerfMatrixSortOpen(false);
													}}
												>
													<PopoverTrigger
														type="button"
														className={cn(
															buttonVariants({ variant: "outline", size: "sm" }),
															"group h-8 min-h-8 w-full min-w-0 shrink justify-between gap-2 px-3",
														)}
														aria-expanded={perfMatrixFiltersOpen}
													>
														<span className="flex min-w-0 items-center gap-2">
															<ListFilter className="size-3.5 shrink-0" aria-hidden />
															<span className="font-medium">Filters</span>
															{activePerformanceFilterCount > 0 ? (
																<Badge
																	variant="secondary"
																	className="h-5 min-w-5 px-1.5 font-mono text-[11px]"
																>
																	{activePerformanceFilterCount}
																</Badge>
															) : null}
														</span>
														<ChevronDownIcon
															className={cn(
																"size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
																perfMatrixFiltersOpen && "rotate-180",
															)}
															aria-hidden
														/>
													</PopoverTrigger>
													<PopoverContent
														role="group"
														aria-label="Topic filters"
														align="start"
														side="bottom"
														sideOffset={8}
														className="w-[min(100vw-2rem,20rem)]"
													>
														<div className="flex max-h-[min(24rem,70dvh)] flex-col gap-4 overflow-y-auto">
															<div className="flex min-w-0 flex-col gap-1">
																<span className="text-foreground text-sm font-medium">Subject</span>
																<p className="text-muted-foreground text-xs">One course or all.</p>
																<div className="mt-1 flex flex-col gap-0.5">
																	<Button
																		type="button"
																		variant={detailSubjectId == null ? "secondary" : "ghost"}
																		size="sm"
																		className="h-9 w-full justify-start font-normal"
																		onClick={() => {
																			navigateSubject("all");
																		}}
																	>
																		<BookOpenIcon
																			className="me-2 size-3.5 shrink-0 text-muted-foreground"
																			aria-hidden
																		/>
																		All subjects
																	</Button>
																	{subjectOptions.map((o) => {
																		const selected = detailSubjectId === o.id;
																		return (
																			<Button
																				key={o.id}
																				type="button"
																				variant={selected ? "secondary" : "ghost"}
																				size="sm"
																				className="h-9 w-full justify-start font-normal"
																				onClick={() => {
																					navigateSubject(o.id);
																				}}
																			>
																				<BookOpenIcon
																					className="me-2 size-3.5 shrink-0 text-muted-foreground"
																					aria-hidden
																				/>
																				<span className="min-w-0 truncate">{o.name}</span>
																			</Button>
																		);
																	})}
																</div>
															</div>
															<div className="flex min-w-0 flex-col gap-1 border-border border-t pt-3">
																<span className="text-foreground text-sm font-medium">Performance</span>
																<p className="text-muted-foreground text-xs">
																	Filter by how you&apos;re doing on a topic.
																</p>
																<div
																	className="mt-1 flex flex-wrap gap-2"
																	role="group"
																	aria-label="Filter by performance status"
																>
																	{(["all", "good", "satisfactory", "bad", "not_tested"] as const).map(
																		(s) => {
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
																		},
																	)}
																</div>
															</div>
														</div>
													</PopoverContent>
												</Popover>
											</div>
											<div className="flex min-w-0 flex-1 basis-0">
												<Popover
													open={perfMatrixSortOpen}
													onOpenChange={(open) => {
														setPerfMatrixSortOpen(open);
														if (open) setPerfMatrixFiltersOpen(false);
													}}
												>
													<PopoverTrigger
														type="button"
														className={cn(
															buttonVariants({ variant: "outline", size: "sm" }),
															"group h-8 min-h-8 w-full min-w-0 shrink justify-between gap-2 px-3",
														)}
														aria-expanded={perfMatrixSortOpen}
													>
														<span className="flex min-w-0 items-center gap-2">
															<ArrowDownUp className="size-3.5 shrink-0" aria-hidden />
															<span className="font-medium">Sort</span>
															{performanceSortIsNonDefault ? (
																<Badge variant="outline" className="h-5 text-[11px] font-normal">
																	Custom
																</Badge>
															) : null}
														</span>
														<ChevronDownIcon
															className={cn(
																"size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
																perfMatrixSortOpen && "rotate-180",
															)}
															aria-hidden
														/>
													</PopoverTrigger>
													<PopoverContent
														role="group"
														aria-label="Sort options"
														align="start"
														side="bottom"
														sideOffset={8}
														className="w-[min(100vw-2rem,20rem)]"
													>
														<div className="flex flex-col gap-3">
															<div className="flex min-w-0 flex-col gap-1">
																<span className="text-foreground text-sm font-medium">Sort by</span>
																<p className="text-muted-foreground text-xs">
																	How rows are ordered in the table.
																</p>
																<div className="mt-1 flex flex-col gap-0.5">
																	<Button
																		type="button"
																		variant={sortMode === "curriculum" ? "secondary" : "ghost"}
																		size="sm"
																		className="h-9 w-full justify-start gap-2 font-normal"
																		onClick={() => setSortMode("curriculum")}
																	>
																		<ListOrdered className="size-3.5 shrink-0 text-muted-foreground" />
																		Curriculum order
																	</Button>
																	<Button
																		type="button"
																		variant={sortMode === "last_test" ? "secondary" : "ghost"}
																		size="sm"
																		className="h-9 w-full justify-start gap-2 font-normal"
																		onClick={() => setSortMode("last_test")}
																	>
																		<ArrowDownUp className="size-3.5 shrink-0 text-muted-foreground" />
																		Last test (recent first)
																	</Button>
																	<Button
																		type="button"
																		variant={sortMode === "status" ? "secondary" : "ghost"}
																		size="sm"
																		className="h-9 w-full justify-start gap-2 font-normal"
																		onClick={() => setSortMode("status")}
																	>
																		<LineChartIcon className="size-3.5 shrink-0 text-muted-foreground" />
																		Status (priority)
																	</Button>
																</div>
															</div>
														</div>
													</PopoverContent>
												</Popover>
											</div>
										</div>
									</div>
								</div>
							</div>

							<AnimatePresence mode="wait" initial={false}>
								<motion.div
									key={matrixPresenceKey}
									initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -4 }}
									transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
								>
									{filteredRows.length === 0 ? (
										<div className="border-border border-t bg-background px-4 py-10 text-center text-muted-foreground text-sm dark:bg-transparent">
											{emptyPerformanceMatrixMessage(topicSearch, statusFilter)}
										</div>
									) : (
										<div className="overflow-x-auto border-border border-t">
											<div
												className={cn(
													"max-h-[min(40rem,calc(100dvh-13rem))] overflow-auto bg-background dark:bg-transparent",
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
										</div>
									)}
								</motion.div>
							</AnimatePresence>
						</Card>
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
