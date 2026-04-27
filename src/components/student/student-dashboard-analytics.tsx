"use client";

import Link from "next/link";
import * as React from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	XAxis,
	YAxis,
} from "recharts";
import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { LineChartIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	buildHeatmapDays,
	buildKpi,
	buildSubjectBars,
	buildSummaryLine,
	buildTrendSeries,
	findFocusSubject,
	maxHeatmapCount,
	type StudentDashboardAnalyticsPayload,
} from "@/lib/student/dashboard-analytics";
import { localDateKey } from "@/lib/student/dashboard-performance-stats";

/** Brand-aligned analytics palette (global --chart-* tokens are neutral gray). */
const AP = {
	line: "#2ea070",
	subjectTrack: "color-mix(in srgb, #2ea070 14%, var(--muted))",
	subjectBar: "linear-gradient(90deg, #34d399 0%, #2ea070 55%, #0d9488 100%)",
	topicGood: "#22c55e",
	topicOk: "#38bdf8",
	topicNeeds: "#f59e0b",
	topicUntested: "#a78bfa",
} as const;

const trendConfig = {
	avgScore: {
		label: "Average score",
		color: AP.line,
	},
} satisfies ChartConfig;

function subjectCompactLabel(name: string, maxChars = 13) {
	if (name.length <= maxChars) return name;
	return `${name.slice(0, Math.max(0, maxChars - 1))}…`;
}

type SubjectRow = {
	fullLabel: string;
	avg: number;
	hasScore: boolean;
	testCount: number;
};

function SubjectScoreCompactList({ rows }: { rows: SubjectRow[] }) {
	return (
		<div className="rounded-xl border border-emerald-600/10 bg-gradient-to-b from-emerald-50/35 to-muted/15 p-3 dark:border-emerald-500/15 dark:from-emerald-950/25 dark:to-muted/10">
			<div className="mb-2 flex items-center justify-between gap-2 border-border/40 border-b pb-2 text-[10px] text-muted-foreground uppercase tracking-wide">
				<span>Subject</span>
				<span className="tabular-nums">0 — 50 — 100</span>
			</div>
			<ul className="flex flex-col gap-2" role="list">
				{rows.map((row) => (
					<li key={row.fullLabel} className="flex items-center gap-2">
						<Tooltip>
							<TooltipTrigger
								render={
									<span className="w-[5.25rem] shrink-0 cursor-default truncate font-medium text-foreground text-xs leading-tight sm:w-[6.25rem]">
										{subjectCompactLabel(row.fullLabel)}
									</span>
								}
							/>
							<TooltipContent side="top" className="max-w-xs text-xs">
								<p className="font-medium">{row.fullLabel}</p>
								<p className="text-muted-foreground">
									{row.hasScore ? `${row.avg}% avg` : "No scored tests yet"} · {row.testCount} test
									{row.testCount === 1 ? "" : "s"}
								</p>
							</TooltipContent>
						</Tooltip>
						<div
							className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
							style={{ background: AP.subjectTrack }}
						>
							<div
								className="h-full rounded-full shadow-sm transition-[width] duration-300 ease-out"
								style={{
									width: `${row.hasScore ? row.avg : 0}%`,
									background: AP.subjectBar,
									minWidth: row.hasScore && row.avg > 0 ? "4px" : undefined,
								}}
							/>
						</div>
						<span
							className="w-10 shrink-0 text-right font-semibold text-emerald-800 text-xs tabular-nums dark:text-emerald-300"
							aria-label={row.hasScore ? `Average ${row.avg} percent` : "No score yet"}
						>
							{row.hasScore ? `${row.avg}%` : "—"}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

type RangeDays = 7 | 30;

function parseLocalDateKey(dateKey: string): Date {
	const [ys, ms, ds] = dateKey.split("-");
	const y = Number(ys);
	const m = Number(ms);
	const d = Number(ds);
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
		return new Date();
	}
	return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function activityTier(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
	if (count <= 0) return 0;
	if (max <= 0) return 1;
	return Math.min(4, Math.ceil((count / max) * 4)) as 1 | 2 | 3 | 4;
}

function AnalyticsActivityCalendar({
	days,
	weeks,
}: {
	days: ReturnType<typeof buildHeatmapDays>;
	weeks: number;
}) {
	const byKey = React.useMemo(() => {
		const m = new Map<string, (typeof days)[number]>();
		for (const h of days) m.set(h.dateKey, h);
		return m;
	}, [days]);

	const maxC = React.useMemo(() => maxHeatmapCount(days), [days]);
	const lastKey = days.length ? days[days.length - 1]!.dateKey : null;
	const firstKey = days.length ? days[0]!.dateKey : null;

	const windowStart = firstKey ? parseLocalDateKey(firstKey) : new Date();
	const windowEnd = lastKey ? parseLocalDateKey(lastKey) : new Date();

	const [month, setMonth] = React.useState(() => {
		if (!days.length) return new Date();
		const e = parseLocalDateKey(days[days.length - 1]!.dateKey);
		return new Date(e.getFullYear(), e.getMonth(), 1);
	});

	React.useEffect(() => {
		if (!lastKey) return;
		const e = parseLocalDateKey(lastKey);
		setMonth(new Date(e.getFullYear(), e.getMonth(), 1));
	}, [lastKey]);

	const [pickedKey, setPickedKey] = React.useState<string | null>(null);

	const modifiers = React.useMemo(
		() => ({
			act1: (d: Date) => activityTier(byKey.get(localDateKey(d))?.count ?? 0, maxC) === 1,
			act2: (d: Date) => activityTier(byKey.get(localDateKey(d))?.count ?? 0, maxC) === 2,
			act3: (d: Date) => activityTier(byKey.get(localDateKey(d))?.count ?? 0, maxC) === 3,
			act4: (d: Date) => activityTier(byKey.get(localDateKey(d))?.count ?? 0, maxC) === 4,
		}),
		[byKey, maxC],
	);

	const modifiersClassNames = React.useMemo(
		() => ({
			act1: "[&_button]:!bg-emerald-200 [&_button]:!text-emerald-950 [&_button:hover]:!bg-emerald-300 dark:[&_button]:!bg-emerald-800/90 dark:[&_button]:!text-emerald-50",
			act2: "[&_button]:!bg-emerald-400 [&_button]:!text-emerald-950 [&_button:hover]:!bg-emerald-500 dark:[&_button]:!bg-emerald-600 dark:[&_button]:!text-white",
			act3: "[&_button]:!bg-emerald-500 [&_button]:!text-white [&_button:hover]:!bg-emerald-600 dark:[&_button]:!bg-emerald-500 dark:[&_button]:!text-white",
			act4: "[&_button]:!bg-teal-600 [&_button]:!text-white [&_button:hover]:!bg-teal-700 dark:[&_button]:!bg-teal-500 dark:[&_button]:!text-white",
		}),
		[],
	);

	const totalMinutes = days.reduce((a, d) => a + d.minutes, 0);
	const picked = pickedKey ? byKey.get(pickedKey) : undefined;

	return (
		<div className="flex flex-col gap-3">
			{totalMinutes > 0 ? (
				<p className="text-muted-foreground text-xs">
					About {Math.round(totalMinutes)} minutes of test time logged in this window.
				</p>
			) : null}
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
				<Calendar
					month={month}
					onMonthChange={setMonth}
					disabled={
						firstKey && lastKey ? [{ before: windowStart }, { after: windowEnd }] : undefined
					}
					modifiers={modifiers}
					modifiersClassNames={modifiersClassNames}
					onDayClick={(date, mods) => {
						if (mods.disabled) return;
						setPickedKey(localDateKey(date));
					}}
					className="w-full max-w-[min(100%,20rem)] rounded-xl border border-border/60 bg-background p-1 shadow-sm [--cell-size:2.25rem] sm:w-fit"
					aria-label={`Test activity calendar, last ${weeks} weeks`}
				/>
				<div className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 dark:bg-muted/10">
					<p className="font-medium text-foreground text-xs">Selected day</p>
					{pickedKey ? (
						<>
							<p className="text-foreground text-sm">{format(parseLocalDateKey(pickedKey), "EEEE, MMMM d, yyyy")}</p>
							{picked && picked.count > 0 ? (
								<p className="text-muted-foreground text-xs">
									{picked.count} test{picked.count === 1 ? "" : "s"}
									{picked.minutes > 0 ? ` · ${picked.minutes} min logged` : ""}
								</p>
							) : (
								<p className="text-muted-foreground text-xs">No tests on this day.</p>
							)}
						</>
					) : (
						<p className="text-muted-foreground text-xs">Click a date in range to see activity.</p>
					)}
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-border/40 border-t pt-3 text-[10px] text-muted-foreground uppercase tracking-wide">
				<span>Less</span>
				<span className="inline-flex size-3.5 shrink-0 rounded-sm bg-emerald-200 dark:bg-emerald-800/90" />
				<span className="inline-flex size-3.5 shrink-0 rounded-sm bg-emerald-400 dark:bg-emerald-600" />
				<span className="inline-flex size-3.5 shrink-0 rounded-sm bg-emerald-500" />
				<span className="inline-flex size-3.5 shrink-0 rounded-sm bg-teal-600 dark:bg-teal-500" />
				<span>More tests</span>
				<span className="ml-1 normal-case tracking-normal opacity-90">({weeks} weeks)</span>
			</div>
		</div>
	);
}

export function StudentDashboardAnalytics({ payload }: { payload: StudentDashboardAnalyticsPayload }) {
	const [rangeDays, setRangeDays] = React.useState<RangeDays>(30);
	const reduceMotion = useReducedMotion();

	const trendSeries = React.useMemo(
		() => buildTrendSeries(payload.tests, rangeDays),
		[payload.tests, rangeDays],
	);
	const subjectBars = React.useMemo(
		() => buildSubjectBars(payload.tests, payload.subjectNames, rangeDays),
		[payload.tests, payload.subjectNames, rangeDays],
	);
	const kpi = React.useMemo(() => buildKpi(payload.tests, rangeDays), [payload.tests, rangeDays]);
	const focus = React.useMemo(() => findFocusSubject(subjectBars), [subjectBars]);
	const summaryLine = React.useMemo(() => buildSummaryLine(kpi, rangeDays), [kpi, rangeDays]);

	const heatmapDays = React.useMemo(() => buildHeatmapDays(payload.tests, 12), [payload.tests]);

	const distData = React.useMemo(
		() => [
			{
				key: "good",
				label: "Good",
				value: payload.distribution.good,
				fill: AP.topicGood,
			},
			{
				key: "satisfactory",
				label: "Satisfactory",
				value: payload.distribution.satisfactory,
				fill: AP.topicOk,
			},
			{
				key: "bad",
				label: "Needs work",
				value: payload.distribution.bad,
				fill: AP.topicNeeds,
			},
			{
				key: "notTested",
				label: "Not tested yet",
				value: payload.distribution.notTested,
				fill: AP.topicUntested,
			},
		],
		[payload.distribution],
	);

	const subjectRows = React.useMemo<SubjectRow[]>(
		() =>
			subjectBars.map((b) => ({
				fullLabel: b.label,
				avg: b.avgScore ?? 0,
				hasScore: b.avgScore != null,
				testCount: b.testCount,
			})),
		[subjectBars],
	);

	const trendFillId = React.useId().replace(/:/g, "");

	const trendAnimation = reduceMotion
		? {}
		: {
				initial: { opacity: 0, y: 8 },
				animate: { opacity: 1, y: 0 },
				transition: { duration: 0.22, ease: "easeOut" as const },
			};

	if (payload.tests.length === 0) {
		return (
			<TooltipProvider>
				<Card className="overflow-hidden shadow-sm">
					<CardContent className="flex min-h-[160px] flex-col items-center justify-center gap-4 bg-gradient-to-b from-emerald-50/30 to-card py-12 dark:from-emerald-950/20">
						<LineChartIcon className="size-10 text-emerald-600/35 dark:text-emerald-400/40" aria-hidden />
						<div className="flex max-w-md flex-col gap-1 text-center">
							<p className="font-medium text-foreground text-sm">No recent activity to chart</p>
							<p className="text-muted-foreground text-sm">
								Complete a practice test to unlock trends, subject comparison, and topic distribution.
							</p>
						</div>
						<Button render={<Link href="/student/practice" />}>Start practice</Button>
					</CardContent>
				</Card>
			</TooltipProvider>
		);
	}

	const hasTestsInRange = kpi.testCount > 0;

	return (
		<TooltipProvider>
			<Card className="overflow-hidden shadow-sm">
				<CardHeader className="gap-4 border-border/50 border-b bg-gradient-to-br from-emerald-50/90 via-card to-card pb-4 dark:from-emerald-950/40 dark:via-card dark:to-card">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div className="flex flex-col gap-1.5">
							<CardTitle className="text-lg tracking-tight">Performance insights</CardTitle>
							<CardDescription className="text-muted-foreground">
								{kpi.testCount > 0 && kpi.avgScore != null
									? `This period: ${kpi.testCount} test${kpi.testCount === 1 ? "" : "s"} · ${kpi.avgScore}% avg`
									: hasTestsInRange
										? `This period: ${kpi.testCount} test${kpi.testCount === 1 ? "" : "s"}`
										: `No tests in the last ${rangeDays} days`}
							</CardDescription>
						</div>
						<div
							className="flex shrink-0 flex-row gap-1 rounded-xl border border-emerald-600/15 bg-emerald-50/60 p-1 dark:border-emerald-500/25 dark:bg-emerald-950/35"
							role="group"
							aria-label="Chart date range"
						>
							{([7, 30] as const).map((d) => (
								<Button
									key={d}
									type="button"
									variant={rangeDays === d ? "default" : "ghost"}
									size="sm"
									className="h-7 px-3"
									onClick={() => setRangeDays(d)}
									aria-pressed={rangeDays === d}
								>
									{d}d
								</Button>
							))}
						</div>
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 bg-gradient-to-b from-muted/10 to-card pt-4 dark:from-muted/5">
					<Tabs defaultValue="overview" className="gap-4">
						<TabsList className="inline-flex h-auto w-full min-w-0 flex-wrap justify-start gap-1 rounded-xl border border-border/60 bg-muted/45 p-1 dark:bg-muted/25">
							{(
								[
									{ value: "overview", label: "Overview" },
									{ value: "trend", label: "Trend" },
									{ value: "subjects", label: "Subjects" },
									{ value: "topics", label: "Topics" },
									{ value: "activity", label: "Activity" },
								] as const
							).map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs data-[active]:shadow-sm sm:px-3 sm:text-sm"
								>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>

						<TabsContent value="overview" className="flex flex-col gap-3">
							<p className="text-foreground text-sm leading-relaxed">{summaryLine}</p>
							{focus && kpi.testCount >= 2 ? (
								<p className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-muted-foreground text-xs leading-relaxed dark:border-emerald-800/50 dark:bg-emerald-950/35">
									<span className="font-medium text-foreground">Focus idea:</span> short sessions on{" "}
									<span className="font-medium text-emerald-800 dark:text-emerald-200">{focus.subjectName}</span>{" "}
									(recent avg {focus.avgScore}%) can lift your balance across subjects.
								</p>
							) : null}
							{!hasTestsInRange && rangeDays === 7 && payload.tests.length > 0 ? (
								<p className="text-amber-800 text-xs dark:text-amber-400">
									No tests in the last 7 days. Try the 30-day view for a wider picture.
								</p>
							) : null}
						</TabsContent>

						<TabsContent value="trend" className="flex flex-col gap-2">
							<p className="text-muted-foreground text-xs">
								Daily average score on days you completed tests (gaps mean no scored tests that day).
							</p>
							<motion.div
								{...trendAnimation}
								className="rounded-xl border border-emerald-600/10 bg-gradient-to-b from-emerald-50/40 to-card p-2 dark:border-emerald-500/15 dark:from-emerald-950/25 dark:to-card"
							>
								<ChartContainer config={trendConfig} className="aspect-auto h-72 w-full sm:h-80 md:h-96">
									<AreaChart data={trendSeries} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
										<defs>
											<linearGradient id={trendFillId} x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor={AP.line} stopOpacity={0.32} />
												<stop offset="92%" stopColor={AP.line} stopOpacity={0.02} />
											</linearGradient>
										</defs>
										<CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-emerald-900/10 dark:stroke-emerald-100/10" />
										<XAxis
											dataKey="label"
											tickLine={false}
											axisLine={false}
											interval={rangeDays === 30 ? 4 : 0}
											tickMargin={8}
											className="text-[10px]"
										/>
										<YAxis
											domain={[0, 100]}
											width={32}
											tickLine={false}
											axisLine={false}
											className="text-[10px]"
											tickFormatter={(v) => `${v}`}
										/>
										<ChartTooltip
											content={
												<ChartTooltipContent
													labelFormatter={(_, p) => {
														const row = p?.[0]?.payload as { label?: string; testCount?: number } | undefined;
														return row?.label ?? "";
													}}
													formatter={(value) => (
														<span className="tabular-nums">
															{typeof value === "number" ? `${value}%` : "—"}
														</span>
													)}
												/>
											}
										/>
										<Area
											type="monotone"
											dataKey="avgScore"
											stroke={AP.line}
											strokeWidth={2.5}
											fill={`url(#${trendFillId})`}
											dot={{ r: 3, fill: AP.line, stroke: "#fff", strokeWidth: 1 }}
											activeDot={{ r: 5, fill: AP.line }}
											connectNulls={false}
										/>
									</AreaChart>
								</ChartContainer>
							</motion.div>
						</TabsContent>

						<TabsContent value="subjects" className="flex flex-col gap-2">
							<p className="text-muted-foreground text-xs">
								Compact view: hover a subject for the full name. Bars use the full width for scores 0–100%.
							</p>
							<motion.div {...trendAnimation}>
								<SubjectScoreCompactList rows={subjectRows} />
							</motion.div>
						</TabsContent>

						<TabsContent value="topics" className="flex flex-col gap-2">
							<p className="text-muted-foreground text-xs">
								How your curriculum topics are currently labeled from practice (not time-scoped).
							</p>
							<motion.div
								{...trendAnimation}
								className="rounded-xl border border-border/60 bg-muted/10 p-2 dark:bg-muted/15"
							>
								<ChartContainer
									config={{
										value: { label: "Topics", color: AP.topicGood },
									}}
									className="aspect-auto h-72 w-full sm:h-80 md:h-96"
								>
									<BarChart data={distData} margin={{ left: 4, right: 8, top: 8, bottom: 28 }}>
										<CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
										<XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-[10px]" />
										<YAxis allowDecimals={false} width={40} tickLine={false} axisLine={false} className="text-[10px]" />
										<ChartTooltip content={<ChartTooltipContent />} />
										<Bar dataKey="value" radius={[6, 6, 0, 0]}>
											{distData.map((entry) => (
												<Cell key={entry.key} fill={entry.fill} />
											))}
										</Bar>
									</BarChart>
								</ChartContainer>
							</motion.div>
						</TabsContent>

						<TabsContent value="activity" className="flex flex-col gap-2">
							<p className="text-muted-foreground text-xs">
								Calendar shows the last 12 weeks; greener days mean more completed tests. Grayed-out dates are
								outside this window.
							</p>
							<motion.div
								{...trendAnimation}
								className="rounded-xl border border-emerald-600/10 bg-gradient-to-b from-emerald-50/35 to-card p-3 dark:border-emerald-500/15 dark:from-emerald-950/25 dark:to-card"
							>
								<AnalyticsActivityCalendar days={heatmapDays} weeks={12} />
							</motion.div>
						</TabsContent>
					</Tabs>
				</CardContent>
				<CardFooter className="flex flex-col items-start gap-1 border-border/50 bg-muted/5 dark:bg-muted/10">
					<p className="text-muted-foreground text-xs">
						Charts use your completed tests. Topic labels update as you practice more topics.
					</p>
				</CardFooter>
			</Card>
		</TooltipProvider>
	);
}
