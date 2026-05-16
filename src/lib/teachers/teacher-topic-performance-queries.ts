import "server-only";

import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { subjects, topics } from "@/db/schema/academic";
import { performanceTracker } from "@/db/schema/assessment";
import { CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT } from "@/lib/teachers/teacher-class-performance-summary";
import { listTeacherPerformanceDirectoryStudents } from "@/lib/teachers/teacher-performance-directory-queries";

export type TeacherTopicPerformanceScope = {
	teacherId: string;
	activeOrganizationId: string | null;
	grade?: number | null;
	section?: string | null;
	subjectId?: string | null;
};

export type TeacherTopicPerformanceRow = {
	topicId: string;
	topicName: string;
	subjectId: string;
	subjectName: string;
	topicGrade: number;
	sortUnit: number;
	sortChapter: number;
	sortTopic: number;
	averagePercent: number;
	studentsWithData: number;
	testsTaken: number;
	studentsBelowSupportLine: number;
};

export type TeacherTopicStudentBreakdownRow = {
	studentId: string;
	fullName: string;
	grade: number | null;
	section: string | null;
	averagePercent: number;
	testsTaken: number;
	status: string | null;
};

function toNumber(score: string | number | null | undefined): number | null {
	if (score == null || score === "") return null;
	const n = typeof score === "number" ? score : Number(score);
	return Number.isFinite(n) ? n : null;
}

function roundPercent(value: number): number {
	return Math.round(value * 10) / 10;
}

/** Aggregates practice-tracker topic scores across students the teacher can access (org roster or linked codes). */
export async function listTeacherTopicPerformanceRows(
	params: TeacherTopicPerformanceScope,
): Promise<TeacherTopicPerformanceRow[]> {
	const roster = await listTeacherPerformanceDirectoryStudents({
		teacherId: params.teacherId,
		activeOrganizationId: params.activeOrganizationId,
		grade: params.grade ?? undefined,
		section: params.section ?? undefined,
		subjectId: params.subjectId ?? undefined,
	});

	if (roster.length === 0) return [];

	const studentIds = roster.map((s) => s.id);

	const topicFilters = [
		inArray(performanceTracker.studentId, studentIds),
		isNotNull(performanceTracker.averageScore),
		gt(performanceTracker.testsTaken, 0),
	];
	const sid = params.subjectId?.trim();
	if (sid) {
		topicFilters.push(eq(performanceTracker.subjectId, sid));
	}

	const topicRows = await db
		.select({
			topicId: performanceTracker.topicId,
			topicName: topics.topicName,
			subjectId: performanceTracker.subjectId,
			subjectName: subjects.name,
			topicGrade: topics.grade,
			unitNumber: topics.unitNumber,
			chapterNumber: topics.chapterNumber,
			topicNumber: topics.topicNumber,
			studentId: performanceTracker.studentId,
			averageScore: performanceTracker.averageScore,
			testsTaken: performanceTracker.testsTaken,
		})
		.from(performanceTracker)
		.innerJoin(topics, eq(topics.id, performanceTracker.topicId))
		.innerJoin(subjects, eq(subjects.id, performanceTracker.subjectId))
		.where(and(...topicFilters));

	type Agg = {
		topicId: string;
		topicName: string;
		subjectId: string;
		subjectName: string;
		topicGrade: number;
		sortUnit: number;
		sortChapter: number;
		sortTopic: number;
		scoreSum: number;
		studentsWithData: number;
		testsTaken: number;
		studentsBelowSupportLine: number;
	};

	const byTopic = new Map<string, Agg>();

	for (const row of topicRows) {
		const averageScore = toNumber(row.averageScore);
		const testsTaken = row.testsTaken ?? 0;
		if (averageScore == null || testsTaken <= 0) continue;

		const bucket =
			byTopic.get(row.topicId) ??
			{
				topicId: row.topicId,
				topicName: row.topicName,
				subjectId: row.subjectId,
				subjectName: row.subjectName,
				topicGrade: row.topicGrade,
				sortUnit: row.unitNumber,
				sortChapter: row.chapterNumber,
				sortTopic: row.topicNumber,
				scoreSum: 0,
				studentsWithData: 0,
				testsTaken: 0,
				studentsBelowSupportLine: 0,
			};

		bucket.scoreSum += averageScore;
		bucket.studentsWithData += 1;
		bucket.testsTaken += testsTaken;
		if (averageScore < CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT) {
			bucket.studentsBelowSupportLine += 1;
		}
		byTopic.set(row.topicId, bucket);
	}

	const list: TeacherTopicPerformanceRow[] = [...byTopic.values()].map((topic) => ({
		topicId: topic.topicId,
		topicName: topic.topicName,
		subjectId: topic.subjectId,
		subjectName: topic.subjectName,
		topicGrade: topic.topicGrade,
		sortUnit: topic.sortUnit,
		sortChapter: topic.sortChapter,
		sortTopic: topic.sortTopic,
		averagePercent: roundPercent(topic.scoreSum / topic.studentsWithData),
		studentsWithData: topic.studentsWithData,
		testsTaken: topic.testsTaken,
		studentsBelowSupportLine: topic.studentsBelowSupportLine,
	}));

	list.sort((a, b) => {
		const sub = a.subjectName.localeCompare(b.subjectName);
		if (sub !== 0) return sub;
		if (a.topicGrade !== b.topicGrade) return a.topicGrade - b.topicGrade;
		if (a.sortUnit !== b.sortUnit) return a.sortUnit - b.sortUnit;
		if (a.sortChapter !== b.sortChapter) return a.sortChapter - b.sortChapter;
		if (a.sortTopic !== b.sortTopic) return a.sortTopic - b.sortTopic;
		return a.topicName.localeCompare(b.topicName);
	});

	return list;
}

export async function listTeacherTopicStudentBreakdown(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	topicId: string;
	grade?: number | null;
	section?: string | null;
	subjectId?: string | null;
}): Promise<{
	topicLabel: string;
	subjectName: string;
	topicSubjectId: string | null;
	rows: TeacherTopicStudentBreakdownRow[];
}> {
	const roster = await listTeacherPerformanceDirectoryStudents({
		teacherId: params.teacherId,
		activeOrganizationId: params.activeOrganizationId,
		grade: params.grade ?? undefined,
		section: params.section ?? undefined,
		subjectId: params.subjectId ?? undefined,
	});

	const rosterById = new Map(roster.map((s) => [s.id, s]));

	if (roster.length === 0) {
		return { topicLabel: "Topic", subjectName: "", topicSubjectId: null, rows: [] };
	}

	const metaRows = await db
		.select({
			topicName: topics.topicName,
			subjectName: subjects.name,
			subjectId: topics.subjectId,
		})
		.from(topics)
		.innerJoin(subjects, eq(subjects.id, topics.subjectId))
		.where(eq(topics.id, params.topicId))
		.limit(1);

	const topicLabel = metaRows[0]?.topicName ?? "Topic";
	const subjectName = metaRows[0]?.subjectName ?? "";
	const topicSubjectId = metaRows[0]?.subjectId ?? null;

	const studentIds = roster.map((s) => s.id);

	const trackerRows = await db
		.select({
			studentId: performanceTracker.studentId,
			averageScore: performanceTracker.averageScore,
			testsTaken: performanceTracker.testsTaken,
			status: performanceTracker.status,
		})
		.from(performanceTracker)
		.where(
			and(
				eq(performanceTracker.topicId, params.topicId),
				inArray(performanceTracker.studentId, studentIds),
				isNotNull(performanceTracker.averageScore),
				gt(performanceTracker.testsTaken, 0),
			),
		);

	const breakdown: TeacherTopicStudentBreakdownRow[] = [];

	for (const row of trackerRows) {
		const avg = toNumber(row.averageScore);
		const testsTaken = row.testsTaken ?? 0;
		if (avg == null || testsTaken <= 0) continue;
		const profile = rosterById.get(row.studentId);
		if (!profile) continue;
		breakdown.push({
			studentId: row.studentId,
			fullName: profile.fullName,
			grade: profile.grade,
			section: profile.section,
			averagePercent: roundPercent(avg),
			testsTaken,
			status: row.status,
		});
	}

	breakdown.sort((a, b) => a.fullName.localeCompare(b.fullName));

	return { topicLabel, subjectName, topicSubjectId, rows: breakdown };
}
