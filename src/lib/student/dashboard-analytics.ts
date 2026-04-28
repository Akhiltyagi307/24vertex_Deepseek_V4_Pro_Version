import { localDateKey } from "@/lib/student/dashboard-performance-stats";
import type { PerformanceRowSerialized } from "@/lib/student/performance-matrix";

export type AnalyticsTestRow = {
	dateKey: string;
	score: number | null;
	subjectId: string;
	durationSec: number | null;
};

export type TopicStatusDistribution = {
	good: number;
	satisfactory: number;
	bad: number;
	notTested: number;
};

export type StudentDashboardAnalyticsPayload = {
	tests: AnalyticsTestRow[];
	distribution: TopicStatusDistribution;
	subjectNames: Record<string, string>;
};

export type TrendChartPoint = {
	dateKey: string;
	label: string;
	avgScore: number | null;
	testCount: number;
};

export type SubjectBarPoint = {
	subjectId: string;
	label: string;
	avgScore: number | null;
	testCount: number;
};

export type HeatmapDay = {
	dateKey: string;
	count: number;
	minutes: number;
};

type DbCompletedTestRow = {
	test_date: string | null;
	total_score: string | number | null;
	subject_id: string;
	duration_seconds: number | null;
};

function parseScore(v: string | number | null | undefined): number | null {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number.parseFloat(String(v));
	return Number.isFinite(n) ? n : null;
}

export function buildTopicStatusDistribution(rows: PerformanceRowSerialized[]): TopicStatusDistribution {
	const out: TopicStatusDistribution = { good: 0, satisfactory: 0, bad: 0, notTested: 0 };
	for (const r of rows) {
		if (r.status === "good") out.good += 1;
		else if (r.status === "satisfactory") out.satisfactory += 1;
		else if (r.status === "bad") out.bad += 1;
		else out.notTested += 1;
	}
	return out;
}

export function serializeCompletedTestsForAnalytics(
	rows: DbCompletedTestRow[],
	options?: { maxDaysBack?: number; end?: Date },
): AnalyticsTestRow[] {
	const end = options?.end ?? new Date();
	let startKey: string | null = null;
	if (options?.maxDaysBack != null) {
		const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
		start.setDate(start.getDate() - (options.maxDaysBack - 1));
		startKey = localDateKey(start);
	}

	const out: AnalyticsTestRow[] = [];
	for (const t of rows) {
		if (!t.test_date) continue;
		const d = new Date(t.test_date);
		if (Number.isNaN(d.getTime())) continue;
		const dateKey = localDateKey(d);
		if (startKey != null && dateKey < startKey) continue;
		out.push({
			dateKey,
			score: parseScore(t.total_score),
			subjectId: t.subject_id,
			durationSec: t.duration_seconds != null && Number.isFinite(t.duration_seconds) ? t.duration_seconds : null,
		});
	}
	return out;
}

export function buildSubjectNamesMap(
	subjects: { id: string; name: string }[],
): Record<string, string> {
	const m: Record<string, string> = {};
	for (const s of subjects) {
		if (s.id && s.name) m[s.id] = s.name;
	}
	return m;
}

export function buildStudentDashboardAnalyticsPayload(
	completedTests: DbCompletedTestRow[],
	trackerRows: PerformanceRowSerialized[],
	enrolledSubjects: { id: string; name: string }[],
	options?: { end?: Date },
): StudentDashboardAnalyticsPayload {
	return {
		tests: serializeCompletedTestsForAnalytics(completedTests, {
			maxDaysBack: 84,
			end: options?.end,
		}),
		distribution: buildTopicStatusDistribution(trackerRows),
		subjectNames: buildSubjectNamesMap(enrolledSubjects),
	};
}

export function filterTestsThroughDate(tests: AnalyticsTestRow[], end: Date): AnalyticsTestRow[] {
	const endKey = localDateKey(end);
	return tests.filter((t) => t.dateKey <= endKey);
}

/** Last `rangeDays` calendar days ending today (inclusive). */
export function filterTestsByRangeDays(tests: AnalyticsTestRow[], rangeDays: 7 | 30, end: Date = new Date()): AnalyticsTestRow[] {
	const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	start.setDate(start.getDate() - (rangeDays - 1));
	const startKey = localDateKey(start);
	const endKey = localDateKey(end);
	return tests.filter((t) => t.dateKey >= startKey && t.dateKey <= endKey);
}

function shortDateLabel(dateKey: string): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	if (!y || !m || !d) return dateKey;
	const dt = new Date(y, m - 1, d);
	return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function buildTrendSeries(tests: AnalyticsTestRow[], rangeDays: 7 | 30, end: Date = new Date()): TrendChartPoint[] {
	const slice = filterTestsByRangeDays(tests, rangeDays, end);
	const byDay = new Map<string, { scores: number[]; count: number }>();
	for (const t of slice) {
		const e = byDay.get(t.dateKey) ?? { scores: [], count: 0 };
		e.count += 1;
		if (t.score != null) e.scores.push(t.score);
		byDay.set(t.dateKey, e);
	}

	const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	start.setDate(start.getDate() - (rangeDays - 1));

	const points: TrendChartPoint[] = [];
	for (let i = 0; i < rangeDays; i++) {
		const cur = new Date(start);
		cur.setDate(start.getDate() + i);
		const dateKey = localDateKey(cur);
		const agg = byDay.get(dateKey);
		const testCount = agg?.count ?? 0;
		const scores = agg?.scores ?? [];
		const avgScore =
			scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
		points.push({ dateKey, label: shortDateLabel(dateKey), avgScore, testCount });
	}
	return points;
}

export function buildSubjectBars(
	tests: AnalyticsTestRow[],
	subjectNames: Record<string, string>,
	rangeDays: 7 | 30,
	end: Date = new Date(),
): SubjectBarPoint[] {
	const slice = filterTestsByRangeDays(tests, rangeDays, end);
	const bySubject = new Map<string, { scores: number[]; count: number }>();
	for (const t of slice) {
		const e = bySubject.get(t.subjectId) ?? { scores: [], count: 0 };
		e.count += 1;
		if (t.score != null) e.scores.push(t.score);
		bySubject.set(t.subjectId, e);
	}

	const enrolledIds = Object.keys(subjectNames);
	const ids = new Set<string>([...enrolledIds, ...bySubject.keys()]);
	const list: SubjectBarPoint[] = [];
	for (const subjectId of ids) {
		const label = subjectNames[subjectId] ?? "Other subject";
		const agg = bySubject.get(subjectId);
		const testCount = agg?.count ?? 0;
		const scores = agg?.scores ?? [];
		const avgScore =
			scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
		list.push({ subjectId, label, avgScore, testCount });
	}

	list.sort((a, b) => a.label.localeCompare(b.label));

	return list.filter((r) => subjectNames[r.subjectId] != null || r.testCount > 0);
}

export function buildKpi(
	tests: AnalyticsTestRow[],
	rangeDays: 7 | 30,
	end: Date = new Date(),
): { testCount: number; avgScore: number | null } {
	const slice = filterTestsByRangeDays(tests, rangeDays, end);
	const scores = slice.map((t) => t.score).filter((s): s is number => s != null);
	return {
		testCount: slice.length,
		avgScore:
			scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
	};
}

/** Last `weeks` * 7 days ending today (inclusive), one bucket per day. */
export function buildHeatmapDays(tests: AnalyticsTestRow[], weeks: number, end: Date = new Date()): HeatmapDay[] {
	const totalDays = weeks * 7;
	const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	const startDay = new Date(endDay);
	startDay.setDate(endDay.getDate() - (totalDays - 1));
	const startKey = localDateKey(startDay);
	const endKey = localDateKey(endDay);

	const countByKey = new Map<string, number>();
	const minutesByKey = new Map<string, number>();
	for (const t of tests) {
		if (t.dateKey < startKey || t.dateKey > endKey) continue;
		countByKey.set(t.dateKey, (countByKey.get(t.dateKey) ?? 0) + 1);
		if (t.durationSec != null && t.durationSec > 0) {
			const prev = minutesByKey.get(t.dateKey) ?? 0;
			minutesByKey.set(t.dateKey, prev + t.durationSec / 60);
		}
	}

	const out: HeatmapDay[] = [];
	for (let i = 0; i < totalDays; i++) {
		const cur = new Date(startDay);
		cur.setDate(startDay.getDate() + i);
		const dateKey = localDateKey(cur);
		out.push({
			dateKey,
			count: countByKey.get(dateKey) ?? 0,
			minutes: Math.round((minutesByKey.get(dateKey) ?? 0) * 10) / 10,
		});
	}
	return out;
}

export function maxHeatmapCount(days: HeatmapDay[]): number {
	let m = 0;
	for (const d of days) m = Math.max(m, d.count);
	return m;
}

export type FocusSubject = {
	subjectId: string;
	subjectName: string;
	avgScore: number;
};

/** Lowest average score among subjects with at least one scored test in range. */
export function findFocusSubject(bars: SubjectBarPoint[]): FocusSubject | null {
	let best: FocusSubject | null = null;
	for (const b of bars) {
		if (b.testCount < 1 || b.avgScore == null) continue;
		if (!best || b.avgScore < best.avgScore) {
			best = { subjectId: b.subjectId, subjectName: b.label, avgScore: b.avgScore };
		}
	}
	return best;
}

export function buildSummaryLine(
	kpi: { testCount: number; avgScore: number | null },
	rangeDays: 7 | 30,
	viewer: "student" | "parent" = "student",
): string {
	if (kpi.testCount === 0) {
		if (viewer === "parent") {
			return rangeDays === 7
				? "No completed tests in the last 7 days. After they take practice tests, trends will show here."
				: "No completed tests in the last 30 days. After they take practice tests, trends will show here.";
		}
		return rangeDays === 7
			? "No completed tests in the last 7 days. Start a practice set to see your trends."
			: "No completed tests in the last 30 days. Start a practice set to see your trends.";
	}
	if (kpi.avgScore != null) {
		return viewer === "parent"
			? `Their average score is ${kpi.avgScore}% across ${kpi.testCount} test${kpi.testCount === 1 ? "" : "s"}.`
			: `Your average score is ${kpi.avgScore}% across ${kpi.testCount} test${kpi.testCount === 1 ? "" : "s"}.`;
	}
	return viewer === "parent"
		? `They completed ${kpi.testCount} test${kpi.testCount === 1 ? "" : "s"} in this period.`
		: `You completed ${kpi.testCount} test${kpi.testCount === 1 ? "" : "s"} in this period.`;
}
