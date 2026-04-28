"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	ArrowDownUp,
	BadgeCheck,
	CalendarClock,
	ChevronDownIcon,
	CircleDot,
	Clock,
	Eye,
	FileDownIcon,
	Gauge,
	Library,
	LineChart,
	ListFilter,
	ListOrdered,
	Search,
} from "lucide-react";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
	formatDuration,
	parseScoreNumber,
	statusSortKey,
	type StudentReportTestRowSerialized,
} from "@/lib/student/subject-test-report";

export type StudentReportsViewProps = {
	initialTests: StudentReportTestRowSerialized[];
	loadError: string | null;
	/** Parent portal: guardian-facing copy (monitoring tone). */
	parentViewer?: boolean;
};

function reportPdfPath(testId: string) {
	return `/api/student/reports/${encodeURIComponent(testId)}/pdf`;
}

function rowTimestamp(r: StudentReportTestRowSerialized): number {
	const raw = r.testDate ?? r.createdAt;
	if (!raw) return 0;
	const t = new Date(raw).getTime();
	return Number.isFinite(t) ? t : 0;
}

function scoreForAverage(r: StudentReportTestRowSerialized): number | null {
	const s = parseScoreNumber(r.totalScore);
	if (s == null) return null;
	if (r.status === "graded") return s;
	if (r.status === "submitted") return s;
	return null;
}

function useReportsStaggerVariants() {
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

export function StudentReportsView({
	initialTests,
	loadError,
	parentViewer = false,
}: StudentReportsViewProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const replaceQuery = React.useCallback(
		(mutate: (p: URLSearchParams) => void) => {
			const p = new URLSearchParams(searchParams.toString());
			mutate(p);
			const qs = p.toString();
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
		},
		[router, pathname, searchParams],
	);

	const [highlightRowId, setHighlightRowId] = React.useState<string | null>(null);
	const didFocusFromGradingRef = React.useRef(false);
	const [filtersOpen, setFiltersOpen] = React.useState(false);
	const [sortOpen, setSortOpen] = React.useState(false);

	React.useEffect(() => {
		if (didFocusFromGradingRef.current) return;
		const tid = searchParams.get("test");
		if (!tid) return;
		didFocusFromGradingRef.current = true;
		setHighlightRowId(tid);
		const raf = window.requestAnimationFrame(() => {
			document.getElementById(`report-row-${tid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
		});
		replaceQuery((p) => {
			p.delete("test");
		});
		const clearHighlight = window.setTimeout(() => setHighlightRowId(null), 10_000);
		return () => {
			window.cancelAnimationFrame(raf);
			window.clearTimeout(clearHighlight);
		};
	}, [searchParams, replaceQuery]);

	const sortKey = searchParams.get("sort") ?? "date";
	const sortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";
	const difficultyFilter = searchParams.get("difficulty") ?? "";
	const outcomeFilter = searchParams.get("outcome") ?? "";
	const subjectFilter = searchParams.get("subject") ?? "";
	/** Single search: `q` (preferred). `sq` is legacy from the old two-field UI. */
	const searchInputValue = searchParams.get("q") ?? searchParams.get("sq") ?? "";

	const overviewStats = React.useMemo(() => {
		const total = initialTests.length;
		const submitted = initialTests.filter((r) => r.status === "submitted").length;
		const graded = initialTests.filter((r) => r.status === "graded").length;
		const scores = initialTests.map(scoreForAverage).filter((n): n is number => n != null);
		const avg =
			scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
		let last = 0;
		for (const r of initialTests) {
			const t = rowTimestamp(r);
			if (t > last) last = t;
		}
		return {
			total,
			submitted,
			graded,
			avgScore: avg,
			lastTestMs: last,
		};
	}, [initialTests]);

	const subjectPillOptions = React.useMemo(() => {
		const map = new Map<string, { id: string; name: string; sort: number }>();
		for (const t of initialTests) {
			if (!map.has(t.subjectId)) {
				map.set(t.subjectId, {
					id: t.subjectId,
					name: t.subjectName,
					sort: t.subjectSortOrder,
				});
			}
		}
		const list = [...map.values()].sort((a, b) => {
			if (a.sort !== b.sort) return a.sort - b.sort;
			return a.name.localeCompare(b.name);
		});
		return [{ value: "", label: "All subjects" }, ...list.map((s) => ({ value: s.id, label: s.name }))];
	}, [initialTests]);

	const q = searchInputValue.trim().toLowerCase();

	let filteredSorted = initialTests.filter((r) => {
		if (subjectFilter && r.subjectId !== subjectFilter) return false;
		if (difficultyFilter) {
			const d = (r.difficulty ?? "").toLowerCase();
			if (d !== difficultyFilter.toLowerCase()) return false;
		}
		if (outcomeFilter && r.status !== outcomeFilter) return false;
		if (q) {
			const unit = (r.unitName ?? "").toLowerCase();
			const subj = r.subjectName.toLowerCase();
			if (!unit.includes(q) && !subj.includes(q)) return false;
		}
		return true;
	});

	const dir = sortDir === "asc" ? 1 : -1;
	const cmp = (a: StudentReportTestRowSerialized, b: StudentReportTestRowSerialized): number => {
		switch (sortKey) {
			case "score": {
				const na = parseScoreNumber(a.totalScore);
				const nb = parseScoreNumber(b.totalScore);
				if (na == null && nb == null) return 0;
				if (na == null) return 1;
				if (nb == null) return -1;
				return (na - nb) * dir;
			}
			case "duration": {
				const na = a.durationSeconds ?? -1;
				const nb = b.durationSeconds ?? -1;
				return (na - nb) * dir;
			}
			case "status":
				return (statusSortKey(a.status) - statusSortKey(b.status)) * dir;
			case "type": {
				const ta = a.testType ?? "";
				const tb = b.testType ?? "";
				return ta.localeCompare(tb) * dir;
			}
			case "subject": {
				if (a.subjectSortOrder !== b.subjectSortOrder) return (a.subjectSortOrder - b.subjectSortOrder) * dir;
				return a.subjectName.localeCompare(b.subjectName) * dir;
			}
			case "correct": {
				const ca = a.correctAnswers ?? -1;
				const cb = b.correctAnswers ?? -1;
				if (ca !== cb) return (ca - cb) * dir;
				return rowTimestamp(a) - rowTimestamp(b);
			}
			case "date":
			default: {
				return (rowTimestamp(a) - rowTimestamp(b)) * dir;
			}
		}
	};
	filteredSorted = [...filteredSorted].sort(cmp);

	const activeFilterCount =
		(subjectFilter ? 1 : 0) +
		(difficultyFilter ? 1 : 0) +
		(outcomeFilter ? 1 : 0);

	const sortIsNonDefault = sortKey !== "date" || sortDir !== "desc";
	const { container, item } = useReportsStaggerVariants();

	return (
		<div className="flex flex-col gap-8 p-6 pb-28">
			<motion.header
				className="flex shrink-0 flex-col gap-1.5"
				initial="hidden"
				animate="show"
				variants={container}
			>
				<motion.h1
					className="font-semibold text-3xl tracking-tight text-balance text-foreground"
					variants={item}
				>
					{parentViewer ? "Test reports" : "Reports"}
				</motion.h1>
				<motion.div variants={item}>
					<PageHeaderSubtext>
						{parentViewer
							? "Review your child’s completed tests, scores, and download PDF copies for your records."
							: "Use this page to review completed tests, track scores, and download PDF copies of your reports."}
					</PageHeaderSubtext>
				</motion.div>
			</motion.header>

			{loadError ? (
				<motion.div initial="hidden" animate="show" variants={item}>
					<Alert variant="destructive">
						<AlertTitle>Could not load tests</AlertTitle>
						<AlertDescription>{loadError}</AlertDescription>
					</Alert>
				</motion.div>
			) : null}

			<motion.section
				aria-labelledby="report-stats-heading"
				className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
				initial="hidden"
				animate="show"
				variants={container}
			>
				<h2 id="report-stats-heading" className="sr-only">
					Reports summary
				</h2>
				<motion.div variants={item}>
					<Card className="shadow-none">
						<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
							<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Total reports</CardTitle>
							<Library
								className="size-8 shrink-0 text-cyan-600 dark:text-cyan-400"
								strokeWidth={2}
								aria-hidden
							/>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-2xl tabular-nums">{overviewStats.total}</p>
							<p className="text-muted-foreground text-xs">{parentViewer ? "On this list" : "On your list"}</p>
						</CardContent>
					</Card>
				</motion.div>
				<motion.div variants={item}>
					<Card className="shadow-none">
						<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
							<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Submitted</CardTitle>
							<Clock
								className="size-8 shrink-0 text-amber-600 dark:text-amber-400"
								strokeWidth={2}
								aria-hidden
							/>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-2xl tabular-nums">{overviewStats.submitted}</p>
							<p className="text-muted-foreground text-xs">Waiting on a final score</p>
						</CardContent>
					</Card>
				</motion.div>
				<motion.div variants={item}>
					<Card className="shadow-none">
						<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
							<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Graded</CardTitle>
							<BadgeCheck
								className="size-8 shrink-0 text-emerald-600 dark:text-emerald-400"
								strokeWidth={2}
								aria-hidden
							/>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-2xl tabular-nums">{overviewStats.graded}</p>
							<p className="text-muted-foreground text-xs">Fully graded</p>
						</CardContent>
					</Card>
				</motion.div>
				<motion.div variants={item}>
					<Card className="shadow-none">
						<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
							<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Average score</CardTitle>
							<LineChart
								className="size-8 shrink-0 text-violet-600 dark:text-violet-400"
								strokeWidth={2}
								aria-hidden
							/>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-2xl tabular-nums">
								{overviewStats.avgScore != null ? `${overviewStats.avgScore}%` : "—"}
							</p>
							<p className="text-muted-foreground text-xs">Across tests in the table</p>
						</CardContent>
					</Card>
				</motion.div>
				<motion.div variants={item}>
					<Card className="shadow-none">
						<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
							<CardTitle className="min-w-0 flex-1 text-sm font-semibold leading-snug">Last test</CardTitle>
							<CalendarClock
								className="size-8 shrink-0 text-sky-600 dark:text-sky-400"
								strokeWidth={2}
								aria-hidden
							/>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-2xl leading-snug">
								{overviewStats.lastTestMs
									? new Date(overviewStats.lastTestMs).toLocaleDateString("en-US", {
											dateStyle: "medium",
										})
									: "—"}
							</p>
							<p className="text-muted-foreground text-xs">
								{parentViewer ? "Their last submitted test" : "When you last submitted"}
							</p>
						</CardContent>
					</Card>
				</motion.div>
			</motion.section>

			<motion.section
				aria-labelledby="report-filters-heading"
				className="flex flex-col gap-4"
				initial="hidden"
				animate="show"
				variants={item}
			>
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<h2
						id="report-filters-heading"
						className="m-0 font-mono text-muted-foreground text-xs uppercase tracking-wider"
					>
						Find a test
					</h2>
					<p className="m-0 shrink-0 text-muted-foreground text-xs">
						Showing{" "}
						<span className="font-medium tabular-nums text-foreground">{filteredSorted.length}</span> of{" "}
						<span className="font-medium tabular-nums text-foreground">{initialTests.length}</span>
					</p>
				</div>
				<Card className="overflow-hidden p-0 shadow-none">
						<div className="p-[22px]">
							<div className="flex flex-col gap-6 md:flex-row md:items-stretch">
						<div className="flex min-w-0 flex-1 flex-col gap-3 md:min-h-0">
							<Label htmlFor="report-search" className="text-foreground text-sm font-medium">
								Search
							</Label>
							<p className="m-0 text-muted-foreground text-xs leading-relaxed">
								Search <span className="font-medium text-foreground">subject names</span> and{" "}
								<span className="font-medium text-foreground">unit or chapter</span> labels in the list.
							</p>
							<Input
								id="report-search"
								placeholder="e.g. Algebra, English, Unit 3…"
								value={searchInputValue}
								onChange={(e) => {
									const v = e.target.value;
									replaceQuery((p) => {
										p.delete("sq");
										if (v) p.set("q", v);
										else p.delete("q");
									});
								}}
								className="box-border h-8 w-1/2 min-w-0 max-w-[50%] md:mt-auto"
								autoComplete="off"
							/>
						</div>

						<div className="flex min-w-0 flex-1 flex-col gap-3 border-border border-t pt-6 md:min-h-0 md:border-t-0 md:border-l md:pl-8 md:pt-0">
							<p className="m-0 text-foreground text-sm font-medium leading-none">Filter and Sort</p>
							<p className="m-0 text-muted-foreground text-xs leading-relaxed">
								<span className="font-medium text-foreground">Filters</span> and{" "}
								<span className="font-medium text-foreground">Sort</span> open as floating panels over the
								page. Opening one closes the other.
							</p>
							<div className="flex w-1/2 min-w-0 max-w-[50%] gap-3 md:mt-auto">
								<div className="flex min-w-0 flex-1 basis-0">
									<Popover
										open={filtersOpen}
										onOpenChange={(open) => {
											setFiltersOpen(open);
											if (open) setSortOpen(false);
										}}
									>
										<PopoverTrigger
											type="button"
											className={cn(
												buttonVariants({ variant: "outline", size: "sm" }),
												"group h-8 min-h-8 w-full min-w-0 shrink justify-between gap-2 px-3",
											)}
											aria-expanded={filtersOpen}
										>
										<span className="flex min-w-0 items-center gap-2">
											<ListFilter className="size-3.5 shrink-0" aria-hidden />
											<span className="font-medium">Filters</span>
											{activeFilterCount > 0 ? (
												<Badge variant="secondary" className="h-5 min-w-5 px-1.5 font-mono text-[11px]">
													{activeFilterCount}
												</Badge>
											) : null}
										</span>
										<ChevronDownIcon
											className={cn(
												"size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
												filtersOpen && "rotate-180",
											)}
											aria-hidden
										/>
									</PopoverTrigger>
									<PopoverContent
										role="group"
										aria-label="Report filters"
										align="start"
										side="bottom"
										sideOffset={8}
									>
										<div className="flex flex-col gap-3">
											<div className="flex min-w-0 flex-col gap-1">
												<span className="text-foreground text-sm font-medium">Subject</span>
												<p className="text-muted-foreground text-xs">One course or all.</p>
												<ReportsPillSelect
													menuTitle="Subject"
													ariaLabel="Filter reports by subject"
													icon={Library}
													value={subjectFilter}
													options={subjectPillOptions}
													className="w-full max-w-none sm:w-full"
													onValueChange={(v) => {
														replaceQuery((p) => {
															if (v) p.set("subject", v);
															else p.delete("subject");
														});
													}}
												/>
											</div>
											<div className="flex min-w-0 flex-col gap-1">
												<span className="text-foreground text-sm font-medium">Difficulty</span>
												<p className="text-muted-foreground text-xs">Question mix level.</p>
												<ReportsPillSelect
													menuTitle="Difficulty"
													ariaLabel="Filter by difficulty"
													icon={Gauge}
													value={difficultyFilter}
													options={[
														{ value: "", label: "All levels" },
														{ value: "easy", label: "Easy" },
														{ value: "medium", label: "Medium" },
														{ value: "hard", label: "Hard" },
														{ value: "mixed", label: "Mixed" },
													]}
													className="w-full max-w-none sm:w-full"
													onValueChange={(v) => {
														replaceQuery((p) => {
															if (v) p.set("difficulty", v);
															else p.delete("difficulty");
														});
													}}
												/>
											</div>
											<div className="flex min-w-0 flex-col gap-1">
												<span className="text-foreground text-sm font-medium">Grading status</span>
												<p className="text-muted-foreground text-xs">Submitted vs fully graded.</p>
												<ReportsPillSelect
													menuTitle="Grading status"
													ariaLabel="Filter by grading status"
													icon={CircleDot}
													value={outcomeFilter}
													options={[
														{ value: "", label: "All statuses" },
														{ value: "submitted", label: "Submitted" },
														{ value: "graded", label: "Graded" },
													]}
													className="w-full max-w-none sm:w-full"
													onValueChange={(v) => {
														replaceQuery((p) => {
															if (v) p.set("outcome", v);
															else p.delete("outcome");
														});
													}}
												/>
											</div>
										</div>
									</PopoverContent>
									</Popover>
								</div>
								<div className="flex min-w-0 flex-1 basis-0">
									<Popover
										open={sortOpen}
										onOpenChange={(open) => {
											setSortOpen(open);
											if (open) setFiltersOpen(false);
										}}
									>
										<PopoverTrigger
											type="button"
											className={cn(
												buttonVariants({ variant: "outline", size: "sm" }),
												"group h-8 min-h-8 w-full min-w-0 shrink justify-between gap-2 px-3",
											)}
											aria-expanded={sortOpen}
										>
										<span className="flex min-w-0 items-center gap-2">
											<ArrowDownUp className="size-3.5 shrink-0" aria-hidden />
											<span className="font-medium">Sort</span>
											{sortIsNonDefault ? (
												<Badge variant="outline" className="h-5 text-[11px] font-normal">
													Custom
												</Badge>
											) : null}
										</span>
										<ChevronDownIcon
											className={cn(
												"size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
												sortOpen && "rotate-180",
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
									>
										<div className="flex flex-col gap-3">
											<div className="flex min-w-0 flex-col gap-1">
												<span className="text-foreground text-sm font-medium">Sort by</span>
												<p className="text-muted-foreground text-xs">Which column orders rows.</p>
												<ReportsPillSelect
													menuTitle="Sort by"
													ariaLabel="Choose column to sort by"
													icon={ListOrdered}
													value={sortKey}
													options={[
														{ value: "date", label: "Test date" },
														{ value: "subject", label: "Subject" },
														{ value: "score", label: "Score" },
														{ value: "correct", label: "Correct answers" },
														{ value: "duration", label: "Duration" },
														{ value: "status", label: "Status" },
														{ value: "type", label: "Test type" },
													]}
													className="w-full max-w-none sm:w-full"
													onValueChange={(v) => {
														replaceQuery((p) => {
															p.set("sort", v);
														});
													}}
												/>
											</div>
											<div className="flex min-w-0 flex-col gap-1">
												<span className="text-foreground text-sm font-medium">Sort order</span>
												<p className="text-muted-foreground text-xs">Newest/highest first or the reverse.</p>
												<ReportsPillSelect
													menuTitle="Sort order"
													ariaLabel="Sort ascending or descending"
													icon={ArrowDownUp}
													value={sortDir}
													options={[
														{ value: "desc", label: "Descending" },
														{ value: "asc", label: "Ascending" },
													]}
													className="w-full max-w-none sm:w-full"
													onValueChange={(v) => {
														replaceQuery((p) => {
															p.set("dir", v);
														});
													}}
												/>
											</div>
										</div>
									</PopoverContent>
									</Popover>
								</div>
							</div>
						</div>
							</div>
						</div>
						<div className="overflow-x-auto border-border border-t">
							<h2 id="report-table-heading" className="sr-only">
								All tests
							</h2>
							<table
								aria-labelledby="report-table-heading"
								className="w-full min-w-[880px] border-collapse text-left text-sm"
							>
						<thead>
							<tr className="border-border border-b bg-muted/85 dark:bg-muted/70">
								<th scope="col" className="px-4 py-3 font-medium">
									Date
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Subject
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Type
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Status
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Unit
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Score
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Correct
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Duration
								</th>
								<th scope="col" className="px-4 py-3 text-right font-medium">
									Report
								</th>
							</tr>
						</thead>
						<tbody className="[&_tr]:bg-background dark:[&_tr]:bg-transparent">
							{initialTests.length === 0 ? (
								<tr>
									<td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
										<div className="mx-auto flex max-w-sm flex-col items-center gap-2">
											<Search className="size-8 opacity-40" aria-hidden />
											<span>No submitted or graded tests yet. Finish a practice test to see it here.</span>
										</div>
									</td>
								</tr>
							) : filteredSorted.length === 0 ? (
								<tr>
									<td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
										No tests match the current filters.
									</td>
								</tr>
							) : (
								filteredSorted.map((r) => {
									const dateStr = r.testDate
										? new Date(r.testDate).toLocaleString("en-US", {
												dateStyle: "medium",
												timeStyle: "short",
											})
										: r.createdAt
											? new Date(r.createdAt).toLocaleString("en-US", {
													dateStyle: "medium",
													timeStyle: "short",
												})
											: "—";
									const correct = r.correctAnswers ?? 0;
									const totalQ = r.totalQuestions ?? 0;
									const pdfBase = reportPdfPath(r.id);
									const pdfViewHref = `${pdfBase}?disposition=inline`;
									const pdfDownloadHref = `${pdfBase}?disposition=attachment`;
									return (
										<tr
											key={r.id}
											id={`report-row-${r.id}`}
											className={cn(
												"border-border border-b last:border-b-0 hover:bg-muted/50 dark:hover:bg-muted/20",
												highlightRowId === r.id &&
													"bg-primary/[0.07] ring-2 ring-primary/30 ring-inset dark:bg-primary/[0.12]",
											)}
										>
											<td className="px-4 py-3 tabular-nums text-muted-foreground">{dateStr}</td>
											<td className="max-w-[200px] truncate px-4 py-3 font-medium text-foreground">
												{r.subjectName}
											</td>
											<td className="px-4 py-3 capitalize">{r.testType ?? "—"}</td>
											<td className="px-4 py-3">
												<Badge variant="secondary" className="capitalize font-normal">
													{(r.status ?? "—").replace("_", " ")}
												</Badge>
												{r.isDraft ? (
													<Badge variant="outline" className="ml-1 font-normal">
														Draft
													</Badge>
												) : null}
											</td>
											<td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground">
												{r.unitName?.trim() ? r.unitName : "—"}
											</td>
											<td className="px-4 py-3 tabular-nums">
												{(() => {
													const s = parseScoreNumber(r.totalScore);
													if (s == null) return "—";
													const avg = overviewStats.avgScore;
													const delta = avg != null ? Math.round(s) - avg : null;
													return (
														<span className="inline-flex items-baseline gap-1.5">
															<span>{Math.round(s)}%</span>
															{delta != null && delta !== 0 ? (
																<span
																	className={cn(
																		"text-[11px] tabular-nums",
																		delta > 0
																			? "text-emerald-700 dark:text-emerald-400"
																			: "text-destructive",
																	)}
																	title={
																	parentViewer
																		? "vs average across all tests in this list"
																		: "vs average across all your reports"
																}
																>
																	{delta > 0 ? "+" : ""}
																	{delta}
																</span>
															) : null}
														</span>
													);
												})()}
											</td>
											<td className="px-4 py-3 tabular-nums text-muted-foreground">
												{totalQ > 0 ? `${correct} / ${totalQ}` : "—"}
											</td>
											<td className="px-4 py-3 tabular-nums text-muted-foreground">
												{formatDuration(r.durationSeconds)}
											</td>
											<td className="px-4 py-3 text-right">
												<div className="flex flex-wrap items-center justify-end gap-1.5">
													<Button
														type="button"
														size="sm"
														variant="outline"
														className="gap-1.5"
														render={
															<a
																href={pdfViewHref}
																target="_blank"
																rel="noopener noreferrer"
															/>
														}
													>
														<Eye className="size-3.5" aria-hidden />
														View
													</Button>
													<Button
														type="button"
														size="sm"
														variant="outline"
														className="gap-1.5"
														render={
															<a
																href={pdfDownloadHref}
																target="_blank"
																rel="noopener noreferrer"
																download
															/>
														}
													>
														<FileDownIcon className="size-3.5" aria-hidden />
														Download
													</Button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
						</div>
					</Card>
			</motion.section>
		</div>
	);
}
