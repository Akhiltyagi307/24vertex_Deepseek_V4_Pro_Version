"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	ArrowDownUp,
	BookOpen,
	ChevronDownIcon,
	CircleDot,
	Eye,
	FileDownIcon,
	Gauge,
	Library,
	ListFilter,
	ListOrdered,
	Search,
} from "lucide-react";
import * as React from "react";

import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
};

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

export function StudentReportsView({ initialTests, loadError }: StudentReportsViewProps) {
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
	const typeFilter = searchParams.get("type") ?? "";
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
		const selfN = initialTests.filter((r) => r.testType === "self").length;
		const asgN = initialTests.filter((r) => r.testType === "assigned").length;
		return {
			total,
			submitted,
			graded,
			avgScore: avg,
			lastTestMs: last,
			selfN,
			asgN,
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
		if (typeFilter && r.testType !== typeFilter) return false;
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
		(typeFilter ? 1 : 0) +
		(difficultyFilter ? 1 : 0) +
		(outcomeFilter ? 1 : 0);

	const sortIsNonDefault = sortKey !== "date" || sortDir !== "desc";

	return (
		<div className="flex flex-col gap-8 p-6 pb-28">
			<header className="flex shrink-0 flex-col gap-1.5">
				<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">Reports</h1>
				<p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
					Every practice and assignment you’ve turned in, with scores and PDFs. Filter by subject or unit, sort
					the list, and open or download a report.
				</p>
				<p className="text-muted-foreground text-xs">
					In this list:{" "}
					<span className="font-medium tabular-nums text-foreground">{overviewStats.selfN}</span> practice
					· <span className="font-medium tabular-nums text-foreground">{overviewStats.asgN}</span> from
					assignments
				</p>
			</header>

			{loadError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load tests</AlertTitle>
					<AlertDescription>{loadError}</AlertDescription>
				</Alert>
			) : null}

			<section aria-labelledby="report-stats-heading" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<h2 id="report-stats-heading" className="sr-only">
					Reports summary
				</h2>
				<Card className="border-border shadow-none">
					<CardHeader className="pb-2">
						<CardDescription>Total reports</CardDescription>
						<CardTitle className="font-semibold text-2xl tabular-nums">{overviewStats.total}</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-xs">On your list</CardContent>
				</Card>
				<Card className="border-border shadow-none">
					<CardHeader className="pb-2">
						<CardDescription>Submitted</CardDescription>
						<CardTitle className="font-semibold text-2xl tabular-nums">{overviewStats.submitted}</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-xs">Waiting on a final score</CardContent>
				</Card>
				<Card className="border-border shadow-none">
					<CardHeader className="pb-2">
						<CardDescription>Graded</CardDescription>
						<CardTitle className="font-semibold text-2xl tabular-nums">{overviewStats.graded}</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-xs">Fully graded</CardContent>
				</Card>
				<Card className="border-border shadow-none">
					<CardHeader className="pb-2">
						<CardDescription>Average score</CardDescription>
						<CardTitle className="font-semibold text-2xl tabular-nums">
							{overviewStats.avgScore != null ? `${overviewStats.avgScore}%` : "—"}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-xs">Across tests in the table</CardContent>
				</Card>
				<Card className="border-border shadow-none">
					<CardHeader className="pb-2">
						<CardDescription>Last test</CardDescription>
						<CardTitle className="font-semibold text-lg leading-snug">
							{overviewStats.lastTestMs
								? new Date(overviewStats.lastTestMs).toLocaleDateString("en-US", {
										dateStyle: "medium",
									})
								: "—"}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-xs">When you last submitted</CardContent>
				</Card>
			</section>

			<section aria-labelledby="report-filters-heading" className="flex flex-col gap-4">
				<h2
					id="report-filters-heading"
					className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
				>
					Find a test
				</h2>
				<Card className="border-border shadow-none">
					<CardContent className="flex flex-col gap-4 pt-6">
						<div className="flex flex-col gap-2">
							<Label htmlFor="report-search" className="text-foreground text-sm font-medium">
								Search
							</Label>
							<p className="text-muted-foreground text-xs leading-relaxed">
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
								className="max-w-xl"
								autoComplete="off"
							/>
						</div>

						<div className="border-border border-t pt-1">
							<p className="mb-2 text-muted-foreground text-xs">
								<span className="font-medium text-foreground">Filters</span> and{" "}
								<span className="font-medium text-foreground">Sort</span> open as floating panels over the
								page. Opening one closes the other.
							</p>
							<div className="flex flex-wrap gap-2">
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
											"group min-w-[10rem] justify-between gap-2 px-3",
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
												<span className="text-foreground text-sm font-medium">Test type</span>
												<p className="text-muted-foreground text-xs">Self vs teacher-assigned.</p>
												<ReportsPillSelect
													menuTitle="Test type"
													ariaLabel="Filter by test type"
													icon={BookOpen}
													value={typeFilter}
													options={[
														{ value: "", label: "All types" },
														{ value: "self", label: "Self" },
														{ value: "assigned", label: "Assigned" },
													]}
													className="w-full max-w-none sm:w-full"
													onValueChange={(v) => {
														replaceQuery((p) => {
															if (v) p.set("type", v);
															else p.delete("type");
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
											"group min-w-[10rem] justify-between gap-2 px-3",
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
					</CardContent>
				</Card>
			</section>

			<section aria-labelledby="report-table-heading" className="flex flex-col gap-3">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2
						id="report-table-heading"
						className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
					>
						All tests
					</h2>
					<p className="text-muted-foreground text-xs">
						Showing{" "}
						<span className="font-medium tabular-nums text-foreground">{filteredSorted.length}</span> of{" "}
						<span className="font-medium tabular-nums text-foreground">{initialTests.length}</span>
					</p>
				</div>

				<div
					className={cn(
						"overflow-x-auto rounded-xl border border-border bg-card shadow-sm",
						"dark:shadow-none",
					)}
				>
					<table className="w-full min-w-[880px] border-collapse text-left text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/80 dark:bg-muted/40">
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
										? new Date(r.testDate).toLocaleString(undefined, {
												dateStyle: "medium",
												timeStyle: "short",
											})
										: r.createdAt
											? new Date(r.createdAt).toLocaleString(undefined, {
													dateStyle: "medium",
													timeStyle: "short",
												})
											: "—";
									const correct = r.correctAnswers ?? 0;
									const totalQ = r.totalQuestions ?? 0;
									const pdfBase = `/api/student/reports/${encodeURIComponent(r.id)}/pdf`;
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
																	title="vs average across all your reports"
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
			</section>
		</div>
	);
}
