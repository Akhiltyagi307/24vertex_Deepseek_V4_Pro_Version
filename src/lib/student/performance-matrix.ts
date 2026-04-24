export type TrackerStatus = "good" | "satisfactory" | "bad" | "not_tested";
export type TrackerTrend = "improving" | "declining" | "stable";

export type PerformanceRowSerialized = {
	trackerId: string;
	topicId: string;
	subjectId: string;
	status: TrackerStatus;
	lastTestDate: string | null;
	averageScore: number | null;
	testsTaken: number;
	trend: TrackerTrend;
	updatedAt: string;
	topicName: string;
	unitName: string;
	unitNumber: number;
	chapterName: string;
	chapterNumber: number;
	topicNumber: number;
	grade: number;
	subjectName: string;
	subjectGroup: string | null;
	subjectSortOrder: number;
};

export type PerformanceSummary = {
	total: number;
	good: number;
	satisfactory: number;
	bad: number;
	not_tested: number;
};

export type SortMode = "curriculum" | "last_test" | "status";

type RawTopic = {
	id: string;
	subject_id: string;
	grade: number;
	unit_name: string;
	unit_number: number;
	chapter_name: string;
	chapter_number: number;
	topic_name: string;
	topic_number: number;
};

type RawSubject = {
	id: string;
	name: string;
	subject_group: string | null;
	sort_order: number | null;
};

export type RawTrackerEmbedRow = {
	id: string;
	topic_id: string;
	subject_id: string;
	status: string | null;
	last_test_date: string | null;
	average_score: string | number | null;
	tests_taken: number | null;
	trend: string | null;
	updated_at: string;
	topics: RawTopic | RawTopic[] | null;
	subjects: RawSubject | RawSubject[] | null;
};

function sole<T>(x: T | T[] | null | undefined): T | null {
	if (x == null) return null;
	return Array.isArray(x) ? (x[0] ?? null) : x;
}

function parseScore(v: string | number | null | undefined): number | null {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number.parseFloat(v);
	return Number.isFinite(n) ? n : null;
}

function normalizeStatus(s: string | null | undefined): TrackerStatus {
	if (s === "good" || s === "satisfactory" || s === "bad" || s === "not_tested") return s;
	return "not_tested";
}

function normalizeTrend(s: string | null | undefined): TrackerTrend {
	if (s === "improving" || s === "declining" || s === "stable") return s;
	return "stable";
}

export function normalizePerformanceRows(rows: RawTrackerEmbedRow[]): PerformanceRowSerialized[] {
	const out: PerformanceRowSerialized[] = [];
	for (const row of rows) {
		const topic = sole(row.topics);
		const subject = sole(row.subjects);
		if (!topic || !subject) continue;
		out.push({
			trackerId: row.id,
			topicId: row.topic_id,
			subjectId: row.subject_id,
			status: normalizeStatus(row.status),
			lastTestDate: row.last_test_date,
			averageScore: parseScore(row.average_score),
			testsTaken: row.tests_taken ?? 0,
			trend: normalizeTrend(row.trend),
			updatedAt: row.updated_at,
			topicName: topic.topic_name,
			unitName: topic.unit_name,
			unitNumber: topic.unit_number,
			chapterName: topic.chapter_name,
			chapterNumber: topic.chapter_number,
			topicNumber: topic.topic_number,
			grade: topic.grade,
			subjectName: subject.name,
			subjectGroup: subject.subject_group,
			subjectSortOrder: subject.sort_order ?? 0,
		});
	}
	return out;
}

export function mergeTrackerWithRelations(
	trackerRows: Array<{
		id: string;
		topic_id: string;
		subject_id: string;
		status: string | null;
		last_test_date: string | null;
		average_score: string | number | null;
		tests_taken: number | null;
		trend: string | null;
		updated_at: string;
	}>,
	topicsById: Map<string, RawTopic>,
	subjectsById: Map<string, RawSubject>,
): PerformanceRowSerialized[] {
	const raw: RawTrackerEmbedRow[] = trackerRows.map((r) => ({
		...r,
		topics: topicsById.get(r.topic_id) ?? null,
		subjects: subjectsById.get(r.subject_id) ?? null,
	}));
	return normalizePerformanceRows(raw);
}

export function computeSummary(rows: PerformanceRowSerialized[]): PerformanceSummary {
	const s: PerformanceSummary = { total: rows.length, good: 0, satisfactory: 0, bad: 0, not_tested: 0 };
	for (const r of rows) {
		if (r.status === "good") s.good += 1;
		else if (r.status === "satisfactory") s.satisfactory += 1;
		else if (r.status === "bad") s.bad += 1;
		else s.not_tested += 1;
	}
	return s;
}

const STATUS_SORT_RANK: Record<TrackerStatus, number> = {
	good: 0,
	satisfactory: 1,
	bad: 2,
	not_tested: 3,
};

export function sortPerformanceRows(rows: PerformanceRowSerialized[], mode: SortMode): PerformanceRowSerialized[] {
	const copy = [...rows];
	if (mode === "curriculum") {
		copy.sort((a, b) => {
			if (a.subjectSortOrder !== b.subjectSortOrder) return a.subjectSortOrder - b.subjectSortOrder;
			if (a.subjectName !== b.subjectName) return a.subjectName.localeCompare(b.subjectName);
			if (a.unitNumber !== b.unitNumber) return a.unitNumber - b.unitNumber;
			if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
			return a.topicNumber - b.topicNumber;
		});
		return copy;
	}
	if (mode === "last_test") {
		copy.sort((a, b) => {
			const ta = a.lastTestDate ? new Date(a.lastTestDate).getTime() : 0;
			const tb = b.lastTestDate ? new Date(b.lastTestDate).getTime() : 0;
			if (tb !== ta) return tb - ta;
			if (a.unitNumber !== b.unitNumber) return a.unitNumber - b.unitNumber;
			if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
			return a.topicNumber - b.topicNumber;
		});
		return copy;
	}
	copy.sort((a, b) => {
		const ra = STATUS_SORT_RANK[a.status];
		const rb = STATUS_SORT_RANK[b.status];
		if (ra !== rb) return ra - rb;
		if (a.unitNumber !== b.unitNumber) return a.unitNumber - b.unitNumber;
		if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
		return a.topicNumber - b.topicNumber;
	});
	return copy;
}

export type ChapterGroup = {
	chapterNumber: number;
	chapterName: string;
	rows: PerformanceRowSerialized[];
};

export type UnitGroup = {
	unitNumber: number;
	unitName: string;
	chapters: ChapterGroup[];
};

export function groupByUnitChapter(rows: PerformanceRowSerialized[]): UnitGroup[] {
	const unitMap = new Map<
		number,
		{ unitName: string; chapters: Map<number, { chapterName: string; rows: PerformanceRowSerialized[] }> }
	>();
	for (const row of rows) {
		let u = unitMap.get(row.unitNumber);
		if (!u) {
			u = { unitName: row.unitName, chapters: new Map() };
			unitMap.set(row.unitNumber, u);
		}
		let c = u.chapters.get(row.chapterNumber);
		if (!c) {
			c = { chapterName: row.chapterName, rows: [] };
			u.chapters.set(row.chapterNumber, c);
		}
		c.rows.push(row);
	}
	const units: UnitGroup[] = [];
	const sortedUnitKeys = [...unitMap.keys()].sort((a, b) => a - b);
	for (const un of sortedUnitKeys) {
		const u = unitMap.get(un)!;
		const chapters: ChapterGroup[] = [];
		const sortedCh = [...u.chapters.keys()].sort((a, b) => a - b);
		for (const cn of sortedCh) {
			const ch = u.chapters.get(cn)!;
			ch.rows.sort((a, b) => a.topicNumber - b.topicNumber);
			chapters.push({ chapterNumber: cn, chapterName: ch.chapterName, rows: ch.rows });
		}
		units.push({ unitNumber: un, unitName: u.unitName, chapters });
	}
	return units;
}

export type SubjectFilterOption = {
	id: string;
	name: string;
	subjectGroup: string | null;
	sortOrder: number;
};

export function buildSubjectFilterOptions(rows: PerformanceRowSerialized[]): SubjectFilterOption[] {
	const byId = new Map<string, SubjectFilterOption>();
	for (const r of rows) {
		if (!byId.has(r.subjectId)) {
			byId.set(r.subjectId, {
				id: r.subjectId,
				name: r.subjectName,
				subjectGroup: r.subjectGroup,
				sortOrder: r.subjectSortOrder,
			});
		}
	}
	return [...byId.values()].sort((a, b) => {
		if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
		return a.name.localeCompare(b.name);
	});
}

export type SubjectBentoSummary = {
	subjectId: string;
	subjectName: string;
	sortOrder: number;
	topicCount: number;
	/** Topics with at least one test attempt (status is not `not_tested`). */
	coveredCount: number;
	percentCovered: number;
};

export type EnrolledSubjectCard = {
	subjectId: string;
	subjectName: string;
	sortOrder: number;
	/** Topics in curriculum for this subject and grade (from `topics` table). */
	topicTotal: number;
	/** Tracker rows for this subject with status other than `not_tested`. */
	attemptedCount: number;
	percentCovered: number;
};

/** Per-subject aggregates from tracker rows for subject list cards. */
export type SubjectCardTrackerStats = {
	trackedCount: number;
	good: number;
	satisfactory: number;
	bad: number;
	notTested: number;
	lastTestDate: string | null;
	testsTakenTotal: number;
};

export const emptySubjectCardTrackerStats: SubjectCardTrackerStats = {
	trackedCount: 0,
	good: 0,
	satisfactory: 0,
	bad: 0,
	notTested: 0,
	lastTestDate: null,
	testsTakenTotal: 0,
};

export type SubjectStatusLabel = "Good" | "Satisfactory" | "Bad";

/** Pick a single status label for dashboard/hero cards from tracker bucket counts. */
export function dominantStatusFromTrackerStats(st: SubjectCardTrackerStats): SubjectStatusLabel {
	const tested = st.good + st.satisfactory + st.bad;
	if (tested === 0) return "Satisfactory";
	if (st.good >= st.satisfactory && st.good >= st.bad) return "Good";
	if (st.bad > st.good && st.bad > st.satisfactory) return "Bad";
	return "Satisfactory";
}

/** Mean of per-topic average scores for a subject (tested topics only). */
export function averageTestScorePercentForSubject(
	rows: PerformanceRowSerialized[],
	subjectId: string,
): number | null {
	let sum = 0;
	let n = 0;
	for (const r of rows) {
		if (r.subjectId !== subjectId || r.status === "not_tested") continue;
		if (r.averageScore != null && Number.isFinite(r.averageScore)) {
			sum += r.averageScore;
			n += 1;
		}
	}
	if (!n) return null;
	return Math.round(sum / n);
}

export function buildSubjectCardTrackerStats(rows: PerformanceRowSerialized[]): Map<string, SubjectCardTrackerStats> {
	const map = new Map<string, SubjectCardTrackerStats>();
	for (const r of rows) {
		let e = map.get(r.subjectId);
		if (!e) {
			e = {
				trackedCount: 0,
				good: 0,
				satisfactory: 0,
				bad: 0,
				notTested: 0,
				lastTestDate: null,
				testsTakenTotal: 0,
			};
			map.set(r.subjectId, e);
		}
		e.trackedCount += 1;
		if (r.status === "good") e.good += 1;
		else if (r.status === "satisfactory") e.satisfactory += 1;
		else if (r.status === "bad") e.bad += 1;
		else e.notTested += 1;
		e.testsTakenTotal += r.testsTaken;
		if (r.lastTestDate) {
			const t = new Date(r.lastTestDate).getTime();
			if (!e.lastTestDate || t > new Date(e.lastTestDate).getTime()) {
				e.lastTestDate = r.lastTestDate;
			}
		}
	}
	return map;
}

export type EnrolledSubjectRow = {
	id: string;
	name: string;
	sort_order?: number | null;
};

/** Bento cards from profile enrollment + curriculum topic counts + tracker progress (one row per subject from RPC). */
export function buildEnrolledSubjectCards(
	enrolledSubjects: EnrolledSubjectRow[],
	topicCountBySubjectId: ReadonlyMap<string, number>,
	trackerRows: PerformanceRowSerialized[],
): EnrolledSubjectCard[] {
	const attemptedBySubject = new Map<string, number>();
	for (const r of trackerRows) {
		if (r.status === "not_tested") continue;
		attemptedBySubject.set(r.subjectId, (attemptedBySubject.get(r.subjectId) ?? 0) + 1);
	}

	return enrolledSubjects
		.map((s) => {
			const topicTotal = topicCountBySubjectId.get(s.id) ?? 0;
			const attemptedCount = attemptedBySubject.get(s.id) ?? 0;
			const percentCovered = topicTotal ? Math.round((attemptedCount / topicTotal) * 100) : 0;
			return {
				subjectId: s.id,
				subjectName: s.name,
				sortOrder: s.sort_order ?? 0,
				topicTotal,
				attemptedCount,
				percentCovered,
			};
		})
		.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
			return a.subjectName.localeCompare(b.subjectName);
		});
}

/** One card per subject id — English Part 1 and English Part 2 stay separate. */
export function buildSubjectBentoSummaries(rows: PerformanceRowSerialized[]): SubjectBentoSummary[] {
	const map = new Map<
		string,
		{ subjectName: string; sortOrder: number; topicCount: number; coveredCount: number }
	>();
	for (const r of rows) {
		let e = map.get(r.subjectId);
		if (!e) {
			e = { subjectName: r.subjectName, sortOrder: r.subjectSortOrder, topicCount: 0, coveredCount: 0 };
			map.set(r.subjectId, e);
		}
		e.topicCount += 1;
		if (r.status !== "not_tested") e.coveredCount += 1;
	}
	return [...map.entries()]
		.map(([subjectId, v]) => ({
			subjectId,
			subjectName: v.subjectName,
			sortOrder: v.sortOrder,
			topicCount: v.topicCount,
			coveredCount: v.coveredCount,
			percentCovered: v.topicCount ? Math.round((v.coveredCount / v.topicCount) * 100) : 0,
		}))
		.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
			return a.subjectName.localeCompare(b.subjectName);
		});
}

export function groupOptionsBySubjectGroup(
	options: SubjectFilterOption[],
): Map<string | "__none__", SubjectFilterOption[]> {
	const m = new Map<string | "__none__", SubjectFilterOption[]>();
	for (const o of options) {
		const key = o.subjectGroup?.trim() ? o.subjectGroup : "__none__";
		const list = m.get(key) ?? [];
		list.push(o);
		m.set(key, list);
	}
	for (const list of m.values()) {
		list.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
			return a.name.localeCompare(b.name);
		});
	}
	return m;
}

const MS_PER_DAY = 86_400_000;

/** Point for subject card coverage timeline (local calendar days). */
export type CoverageTimelinePoint = {
	/** UTC ms at start of local day for the x-position. */
	atMs: number;
	/** Cumulative curriculum coverage 0–100 (same denominator as `EnrolledSubjectCard.topicTotal`). */
	pct: number;
};

/** Stable fallback when the precomputed map lacks an id (should not happen in normal use). */
export const emptyCoverageTimelineFallback: CoverageTimelinePoint[] = [
	{ atMs: 0, pct: 0 },
	{ atMs: MS_PER_DAY, pct: 0 },
];

function startOfLocalDayMs(ms: number): number {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/**
 * Cumulative topics attempted over calendar time for one subject (for list-card charts).
 * Uses each tracker row's `lastTestDate`, falling back to `updatedAt`. Rows without dates
 * are treated as activity on "today". This approximates history (first-attempt time is not stored).
 */
export function buildSubjectCoverageTimeline(
	subjectId: string,
	topicTotal: number,
	rows: PerformanceRowSerialized[],
): CoverageTimelinePoint[] {
	if (topicTotal <= 0) return [];

	const today0 = startOfLocalDayMs(Date.now());
	const windowMin = today0 - 120 * MS_PER_DAY;

	const subjectAttempted = rows.filter(
		(r) => r.subjectId === subjectId && r.status !== "not_tested",
	);

	if (subjectAttempted.length === 0) {
		const left = Math.max(windowMin, today0 - 90 * MS_PER_DAY);
		return [
			{ atMs: left, pct: 0 },
			{ atMs: today0, pct: 0 },
		];
	}

	const times = subjectAttempted
		.map((r) => {
			const iso = r.lastTestDate ?? r.updatedAt;
			const t = iso ? new Date(iso).getTime() : NaN;
			return Number.isFinite(t) ? t : today0;
		})
		.sort((a, b) => a - b);

	const daySet = new Set<number>();
	for (const t of times) {
		daySet.add(startOfLocalDayMs(t));
	}
	const sortedDays = [...daySet].sort((a, b) => a - b);

	const firstDay = sortedDays[0]!;
	const padStart = Math.max(windowMin, firstDay - MS_PER_DAY);

	const points: CoverageTimelinePoint[] = [{ atMs: padStart, pct: 0 }];

	let j = 0;
	for (const d0 of sortedDays) {
		const nextDayStart = d0 + MS_PER_DAY;
		while (j < times.length && times[j]! < nextDayStart) {
			j++;
		}
		const pct = Math.min(100, Math.round((j / topicTotal) * 100));
		points.push({ atMs: d0, pct });
	}

	const finalPct = Math.min(100, Math.round((times.length / topicTotal) * 100));
	const last = points[points.length - 1]!;
	if (last.atMs === today0) {
		points[points.length - 1] = { atMs: today0, pct: finalPct };
	} else {
		points.push({ atMs: today0, pct: finalPct });
	}

	return points;
}
