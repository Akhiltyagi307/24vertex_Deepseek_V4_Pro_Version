"use client";

import Link from "next/link";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	BarChart3,
	Crosshair,
	GraduationCap,
	Layers2,
	Library,
	Trophy,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { fetchTeacherPerformanceDirectory } from "./teacher-performance-directory-actions";
import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	TEACHER_DIRECTORY_INACTIVE_THRESHOLD_DAYS,
	type TeacherPerformanceDirectoryRow,
} from "@/lib/teachers/teacher-performance-directory-types";
import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";
import {
	buildSubjectCatalogPillSelectModel,
	type SubjectCatalogRow,
} from "@/lib/teachers/subject-catalog-label";
import { cn } from "@/lib/utils";

type SortKey = "recentAverage" | "band" | "lastActivity" | "overdue" | "name";
type SortDirection = "asc" | "desc";
type QuickFilter = "all" | "at_risk" | "inactive" | "no_data";

const RECENT_WINDOW_SIZE = 5;
const INACTIVE_THRESHOLD_MS = TEACHER_DIRECTORY_INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

const BAND_META: Record<
	TeacherPerformanceBandId,
	{ label: string; chipClass: string; icon: typeof Trophy }
> = {
	strong: {
		label: "Strong",
		chipClass: "border-primary/40 bg-primary/10 text-primary",
		icon: Trophy,
	},
	near_target: {
		label: "Near target",
		chipClass: "border-border bg-muted text-foreground",
		icon: Crosshair,
	},
	needs_support: {
		label: "Needs support",
		chipClass: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
		icon: BarChart3,
	},
	at_risk: {
		label: "At risk",
		chipClass: "border-destructive/40 bg-destructive/10 text-destructive",
		icon: AlertTriangle,
	},
};

function BandChip({ band }: { band: TeacherPerformanceBandId | null }) {
	if (band == null) {
		return (
			<span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/10 px-2 py-0.5 text-muted-foreground text-xs">
				No data
			</span>
		);
	}
	const meta = BAND_META[band];
	const Icon = meta.icon;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
				meta.chipClass,
			)}
		>
			<Icon className="size-3" aria-hidden />
			{meta.label}
		</span>
	);
}

function formatLastActivity(ms: number | null): string {
	if (ms == null) return "—";
	const diff = Date.now() - ms;
	if (diff < 0) return "today";
	const days = Math.floor(diff / (24 * 60 * 60 * 1000));
	if (days === 0) return "today";
	if (days === 1) return "1d ago";
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months === 1) return "1mo ago";
	if (months < 12) return `${months}mo ago`;
	const years = Math.floor(months / 12);
	return years === 1 ? "1y ago" : `${years}y ago`;
}

function isInactive(row: TeacherPerformanceDirectoryRow): boolean {
	if (row.lastActivityMs == null) return false;
	return Date.now() - row.lastActivityMs > INACTIVE_THRESHOLD_MS;
}

function matchesQuickFilter(row: TeacherPerformanceDirectoryRow, filter: QuickFilter): boolean {
	switch (filter) {
		case "all":
			return true;
		case "at_risk":
			return row.band === "at_risk" || row.overdueAssignments > 0;
		case "inactive":
			return isInactive(row);
		case "no_data":
			return row.lastActivityMs == null;
	}
}

function compareRows(
	a: TeacherPerformanceDirectoryRow,
	b: TeacherPerformanceDirectoryRow,
	key: SortKey,
	direction: SortDirection,
): number {
	const dir = direction === "asc" ? 1 : -1;
	switch (key) {
		case "recentAverage": {
			const aHas = a.recentAveragePercent != null;
			const bHas = b.recentAveragePercent != null;
			if (!aHas && !bHas) return a.fullName.localeCompare(b.fullName);
			if (!aHas) return 1; // no-data rows always last
			if (!bHas) return -1;
			const cmp = (a.recentAveragePercent! - b.recentAveragePercent!) * dir;
			return cmp !== 0 ? cmp : a.fullName.localeCompare(b.fullName);
		}
		case "band": {
			const order: Record<TeacherPerformanceBandId, number> = {
				at_risk: 0,
				needs_support: 1,
				near_target: 2,
				strong: 3,
			};
			const aRank = a.band == null ? 99 : order[a.band];
			const bRank = b.band == null ? 99 : order[b.band];
			const cmp = (aRank - bRank) * dir;
			return cmp !== 0 ? cmp : a.fullName.localeCompare(b.fullName);
		}
		case "lastActivity": {
			const aHas = a.lastActivityMs != null;
			const bHas = b.lastActivityMs != null;
			if (!aHas && !bHas) return a.fullName.localeCompare(b.fullName);
			if (!aHas) return 1;
			if (!bHas) return -1;
			const cmp = (b.lastActivityMs! - a.lastActivityMs!) * dir;
			return cmp !== 0 ? cmp : a.fullName.localeCompare(b.fullName);
		}
		case "overdue": {
			const cmp = (b.overdueAssignments - a.overdueAssignments) * dir;
			return cmp !== 0 ? cmp : a.fullName.localeCompare(b.fullName);
		}
		case "name":
			return a.fullName.localeCompare(b.fullName) * dir;
	}
}

const SORT_DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
	recentAverage: "asc", // lowest avg first
	band: "asc", // most at-risk first
	lastActivity: "asc", // most stale first (because the comparator flips)
	overdue: "asc", // most overdue first (the comparator flips)
	name: "asc",
};

type Props = {
	workspaceDescription: string;
	subjectsCatalog: SubjectCatalogRow[];
	initialRows: TeacherPerformanceDirectoryRow[];
	filterOptions: { grades: number[]; sections: string[] };
	initialSubjectId?: string | "all";
};

export function TeacherPerformanceDirectoryPanel({
	workspaceDescription,
	subjectsCatalog,
	initialRows,
	filterOptions,
	initialSubjectId = "all",
}: Props) {
	const [rows, setRows] = useState<TeacherPerformanceDirectoryRow[]>(initialRows);
	const [grade, setGrade] = useState<number | "all">("all");
	const [section, setSection] = useState<string | "all">("all");
	const [subjectId, setSubjectId] = useState<string | "all">(initialSubjectId);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const skipInitialFetch = useRef(true);

	const [sortKey, setSortKey] = useState<SortKey>("recentAverage");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
	const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

	const gradeOptions = useMemo(
		() => [...new Set(filterOptions.grades)].sort((a, b) => a - b),
		[filterOptions.grades],
	);

	const subjectOptions = useMemo(() => {
		if (grade === "all") return subjectsCatalog;
		return subjectsCatalog.filter((s) => s.grade === grade);
	}, [grade, subjectsCatalog]);

	const subjectPillModel = useMemo(
		() => buildSubjectCatalogPillSelectModel(subjectOptions),
		[subjectOptions],
	);

	useEffect(() => {
		if (skipInitialFetch.current) {
			skipInitialFetch.current = false;
			return;
		}
		startTransition(() => {
			void (async () => {
				setError(null);
				const res = await fetchTeacherPerformanceDirectory({ grade, section, subjectId });
				if ("error" in res) {
					setError(res.error);
					return;
				}
				setRows(res.rows);
			})();
		});
	}, [grade, section, subjectId]);

	const handleGradeChange = (value: string) => {
		const nextGrade = value === "" ? "all" : Number(value);
		setGrade(nextGrade);
		const options =
			nextGrade === "all" ? subjectsCatalog : subjectsCatalog.filter((s) => s.grade === nextGrade);
		if (subjectId !== "all" && !options.some((s) => s.id === subjectId)) {
			setSubjectId("all");
		}
	};

	const counts = useMemo(() => {
		let atRisk = 0;
		let inactive = 0;
		let noData = 0;
		for (const r of rows) {
			if (r.band === "at_risk" || r.overdueAssignments > 0) atRisk += 1;
			if (isInactive(r)) inactive += 1;
			if (r.lastActivityMs == null) noData += 1;
		}
		return { atRisk, inactive, noData };
	}, [rows]);

	const visibleRows = useMemo(() => {
		const filtered = rows.filter((r) => matchesQuickFilter(r, quickFilter));
		return [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDirection));
	}, [rows, quickFilter, sortKey, sortDirection]);

	const handleSort = (key: SortKey) => {
		if (key === sortKey) {
			setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
			return;
		}
		setSortKey(key);
		setSortDirection(SORT_DEFAULT_DIRECTION[key]);
	};

	const gradePillValue = grade === "all" ? "" : String(grade);
	const sectionPillValue = section === "all" ? "" : section;
	const subjectPillValue = subjectId === "all" ? "" : subjectId;

	const showingLabel =
		visibleRows.length === rows.length
			? rows.length === 1
				? "Showing 1 student"
				: `Showing ${rows.length} students`
			: `Showing ${visibleRows.length} of ${rows.length}`;

	const summaryParts: string[] = [];
	if (counts.atRisk > 0) summaryParts.push(`${counts.atRisk} at risk`);
	if (counts.inactive > 0)
		summaryParts.push(`${counts.inactive} inactive >${TEACHER_DIRECTORY_INACTIVE_THRESHOLD_DAYS}d`);
	if (counts.noData > 0) summaryParts.push(`${counts.noData} without graded work`);

	return (
		<div className="flex min-h-[calc(100svh-5rem)] w-full min-w-0 flex-col gap-8 py-6">
			<header className="shrink-0 space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Student performance</h1>
				<p className="text-sm text-muted-foreground">{workspaceDescription}</p>
				{summaryParts.length > 0 ? (
					<p className="pt-1 text-muted-foreground text-xs">
						<span className="font-medium tabular-nums text-foreground">{rows.length} students</span>
						{" · "}
						{summaryParts.join(" · ")}
					</p>
				) : null}
			</header>

			<section
				aria-labelledby="teacher-performance-filters-heading"
				className="flex min-h-0 flex-1 flex-col gap-4"
			>
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<h2
						id="teacher-performance-filters-heading"
						className="m-0 font-mono text-muted-foreground text-xs uppercase tracking-wider"
					>
						Find students
					</h2>
					<p className={cn("m-0 shrink-0 text-muted-foreground text-xs", pending && "opacity-70")}>
						<span className="font-medium tabular-nums text-foreground">{showingLabel}</span>
						{pending ? " · Updating…" : ""}
					</p>
				</div>

				{error ? (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}

				<Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-none">
					<div className="shrink-0 p-[22px]">
						<div
							className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							role="group"
							aria-label="Filter students by grade, section, and subject"
						>
							<div className="flex w-[min(14rem,calc(100vw-2.75rem))] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Grade</span>
								<ReportsPillSelect
									fullWidth
									menuTitle="Grade"
									ariaLabel="Filter students by grade"
									icon={GraduationCap}
									value={gradePillValue}
									options={[
										{ value: "", label: "All grades" },
										...gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` })),
									]}
									className="shadow-none"
									onValueChange={handleGradeChange}
								/>
							</div>
							<div className="flex w-[min(14rem,calc(100vw-2.75rem))] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Section</span>
								<ReportsPillSelect
									fullWidth
									menuTitle="Section"
									ariaLabel="Filter students by section"
									icon={Layers2}
									value={sectionPillValue}
									options={[
										{ value: "", label: "All sections" },
										...filterOptions.sections.map((s) => ({ value: s, label: s })),
									]}
									className="shadow-none"
									onValueChange={(v) => setSection(v === "" ? "all" : v)}
								/>
							</div>
							<div className="flex min-w-[min(16rem,calc(100vw-2.75rem))] max-w-[min(28rem,92vw)] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Subject</span>
								<ReportsPillSelect
									fullWidth
									menuWide
									menuTitle="Subject"
									ariaLabel="Filter students by subject"
									icon={Library}
									value={subjectPillValue}
									options={subjectPillModel.options}
									optionGroups={subjectPillModel.optionGroups}
									className="shadow-none"
									onValueChange={(v) => setSubjectId(v === "" ? "all" : v)}
								/>
							</div>
						</div>

						<div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick filter">
							<QuickFilterChip
								active={quickFilter === "all"}
								onClick={() => setQuickFilter("all")}
								label="All"
								count={rows.length}
							/>
							<QuickFilterChip
								active={quickFilter === "at_risk"}
								onClick={() => setQuickFilter("at_risk")}
								label="At risk"
								count={counts.atRisk}
								tone="destructive"
								disabled={counts.atRisk === 0}
							/>
							<QuickFilterChip
								active={quickFilter === "inactive"}
								onClick={() => setQuickFilter("inactive")}
								label={`Inactive >${TEACHER_DIRECTORY_INACTIVE_THRESHOLD_DAYS}d`}
								count={counts.inactive}
								tone="warning"
								disabled={counts.inactive === 0}
							/>
							<QuickFilterChip
								active={quickFilter === "no_data"}
								onClick={() => setQuickFilter("no_data")}
								label="No graded work"
								count={counts.noData}
								disabled={counts.noData === 0}
							/>
						</div>
					</div>

					<div className="flex min-h-[min(60vh,28rem)] flex-1 flex-col border-border border-t bg-muted/5">
						{visibleRows.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center text-muted-foreground text-sm medium:py-20">
								<p className="max-w-md text-pretty leading-relaxed">
									{rows.length === 0
										? "No students match these filters. Try different filters, use Link Student to connect students when you’re outside an organization, or confirm your organization roster."
										: "No students match the selected quick filter. Try a different one or switch to All."}
								</p>
							</div>
						) : (
							<div className="flex min-h-0 flex-1 flex-col overflow-auto">
								<div className="min-w-0 flex-1">
									<div className="min-w-[920px]">
										<div
											className="grid grid-cols-[minmax(0,1.4fr)_3.5rem_3.5rem_minmax(0,7.5rem)_minmax(0,7.5rem)_minmax(0,5.5rem)_minmax(0,5rem)_auto] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-muted-foreground text-xs font-medium uppercase tracking-wide"
											role="row"
										>
											<SortableHeader
												label="Name"
												active={sortKey === "name"}
												direction={sortDirection}
												onClick={() => handleSort("name")}
											/>
											<span>Grade</span>
											<span>Sec.</span>
											<SortableHeader
												label={`Recent avg (${RECENT_WINDOW_SIZE})`}
												active={sortKey === "recentAverage"}
												direction={sortDirection}
												onClick={() => handleSort("recentAverage")}
												title={`Average of last ${RECENT_WINDOW_SIZE} graded items (assignments + practice)`}
											/>
											<SortableHeader
												label="Band"
												active={sortKey === "band"}
												direction={sortDirection}
												onClick={() => handleSort("band")}
												title="Performance band based on recent average"
											/>
											<SortableHeader
												label="Last seen"
												active={sortKey === "lastActivity"}
												direction={sortDirection}
												onClick={() => handleSort("lastActivity")}
												title="Time since last graded item"
											/>
											<SortableHeader
												label="Overdue"
												active={sortKey === "overdue"}
												direction={sortDirection}
												onClick={() => handleSort("overdue")}
												title="Published assignments past due that this student has not submitted"
											/>
											<span className="text-right"> </span>
										</div>
										<ul className="divide-y divide-border/80 bg-background">
											{visibleRows.map((row) => (
												<li
													key={row.id}
													className="grid grid-cols-[minmax(0,1.4fr)_3.5rem_3.5rem_minmax(0,7.5rem)_minmax(0,7.5rem)_minmax(0,5.5rem)_minmax(0,5rem)_auto] items-center gap-2 px-4 py-3 text-sm"
												>
													<span className="min-w-0">
														<span className="block truncate font-medium">{row.fullName}</span>
														{row.studentLinkCode ? (
															<span className="block truncate font-mono text-[11px] text-muted-foreground tabular-nums">
																{row.studentLinkCode}
															</span>
														) : null}
													</span>
													<span className="text-muted-foreground tabular-nums">{row.grade ?? "—"}</span>
													<span className="text-muted-foreground">{row.section?.trim() || "—"}</span>
													<span className="flex items-baseline gap-1.5 tabular-nums">
														{row.recentAveragePercent != null ? (
															<>
																<span className="font-medium text-foreground">
																	{Math.round(row.recentAveragePercent)}%
																</span>
																<span className="text-muted-foreground text-[11px]">
																	({row.recentItemsUsed}/{RECENT_WINDOW_SIZE})
																</span>
															</>
														) : (
															<span className="text-muted-foreground">—</span>
														)}
													</span>
													<span>
														<BandChip band={row.band} />
													</span>
													<span className="text-muted-foreground text-xs tabular-nums">
														{formatLastActivity(row.lastActivityMs)}
													</span>
													<span className="tabular-nums">
														{row.overdueAssignments > 0 ? (
															<Badge variant="destructive" className="font-normal">
																{row.overdueAssignments}
															</Badge>
														) : (
															<span className="text-muted-foreground">0</span>
														)}
													</span>
													<div className="flex justify-end">
														<Button
															render={<Link href={`/teacher/student-performance/${row.id}/performance`} />}
															size="sm"
															variant="outline"
															className="whitespace-nowrap"
														>
															View performance
														</Button>
													</div>
												</li>
											))}
										</ul>
									</div>
								</div>
							</div>
						)}
					</div>
				</Card>
			</section>
		</div>
	);
}

function SortableHeader({
	label,
	active,
	direction,
	onClick,
	title,
}: {
	label: string;
	active: boolean;
	direction: SortDirection;
	onClick: () => void;
	title?: string;
}) {
	const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
	const ariaLabel = active
		? `${label}, sorted ${direction === "asc" ? "ascending" : "descending"}. Activate to toggle direction.`
		: `${label}, not sorted. Activate to sort.`;
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			aria-label={ariaLabel}
			aria-pressed={active}
			className={cn(
				"-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-medium uppercase tracking-wide outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
				active ? "text-foreground" : "text-muted-foreground",
			)}
		>
			<span className="truncate">{label}</span>
			<Icon className="size-3 shrink-0 opacity-70" aria-hidden />
		</button>
	);
}

function QuickFilterChip({
	active,
	onClick,
	label,
	count,
	tone,
	disabled,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	count: number;
	tone?: "destructive" | "warning";
	disabled?: boolean;
}) {
	const toneClass =
		tone === "destructive"
			? active
				? "border-destructive/50 bg-destructive/15 text-destructive"
				: "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
			: tone === "warning"
				? active
					? "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-100"
					: "border-amber-500/30 bg-amber-500/5 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100"
				: active
					? "border-foreground/30 bg-foreground/10 text-foreground"
					: "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground";
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={active}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
				toneClass,
				disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
			)}
		>
			<span>{label}</span>
			<span className="rounded-full bg-background/60 px-1.5 py-px text-[11px] tabular-nums">{count}</span>
		</button>
	);
}
