import "server-only";

import { and, eq, gt, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { subjects, topics } from "@/db/schema/academic";
import { performanceTracker } from "@/db/schema/assessment";
import { CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT } from "@/lib/teachers/teacher-class-performance-summary";
import { teacherCanAccessStudentForSession } from "@/lib/teachers/teacher-student-access";

export const INTERVENTION_WEAK_TOPICS_LIMIT = 8;

export type StudentWeakTopic = {
	topicId: string;
	topicName: string;
	averagePercent: number;
	testsTaken: number;
};

export type StudentInterventionTarget = {
	subjectId: string;
	subjectName: string;
	topics: StudentWeakTopic[];
};

type WeakTopicRow = StudentWeakTopic & { subjectId: string; subjectName: string };

/**
 * Pick the single subject + ordered weak topics to seed a remedial assignment.
 *
 * Below-support topics only (avg < {@link CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT}%).
 * When `forcedSubjectId` is set (org teachers can only assign their roster
 * subject, and the dashboard subject filter scopes too) we restrict to it;
 * otherwise we target the subject the student is weakest in — most below-support
 * topics first, then lowest average. Pure + exported so the selection logic is
 * unit-tested without the database.
 */
export function selectInterventionTarget(
	rows: WeakTopicRow[],
	opts?: { forcedSubjectId?: string | null; limit?: number },
): StudentInterventionTarget | null {
	const limit = opts?.limit ?? INTERVENTION_WEAK_TOPICS_LIMIT;
	const forcedSubjectId = opts?.forcedSubjectId ?? null;

	const weakRows = rows.filter(
		(row) =>
			Number.isFinite(row.averagePercent) &&
			row.averagePercent < CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT &&
			(!forcedSubjectId || row.subjectId === forcedSubjectId),
	);
	if (weakRows.length === 0) return null;

	const bySubject = new Map<
		string,
		{ subjectId: string; subjectName: string; topics: WeakTopicRow[]; averageSum: number }
	>();
	for (const row of weakRows) {
		const bucket =
			bySubject.get(row.subjectId) ??
			{ subjectId: row.subjectId, subjectName: row.subjectName, topics: [], averageSum: 0 };
		bucket.topics.push(row);
		bucket.averageSum += row.averagePercent;
		bySubject.set(row.subjectId, bucket);
	}

	const chosen = [...bySubject.values()].sort((a, b) => {
		if (b.topics.length !== a.topics.length) return b.topics.length - a.topics.length;
		const avgA = a.averageSum / a.topics.length;
		const avgB = b.averageSum / b.topics.length;
		if (avgA !== avgB) return avgA - avgB;
		return a.subjectName.localeCompare(b.subjectName);
	})[0];

	if (!chosen) return null;

	const orderedTopics = [...chosen.topics]
		.sort(
			(a, b) =>
				a.averagePercent - b.averagePercent ||
				b.testsTaken - a.testsTaken ||
				a.topicName.localeCompare(b.topicName),
		)
		.slice(0, limit)
		.map(({ topicId, topicName, averagePercent, testsTaken }) => ({
			topicId,
			topicName,
			averagePercent,
			testsTaken,
		}));

	return { subjectId: chosen.subjectId, subjectName: chosen.subjectName, topics: orderedTopics };
}

/**
 * Weak-topic target for a single student, scoped to the teacher's access rules.
 * Returns null when the student is outside the teacher's roster or has no
 * below-support topics in the resolved subject.
 */
export async function getStudentInterventionTarget(params: {
	teacherId: string;
	studentId: string;
	/** Dashboard subject filter ("all" or a subject id). */
	subjectId?: string | "all" | null;
	/** Org teachers may only assign their roster subject — forces the target subject. */
	forcedRosterSubjectId?: string | null;
}): Promise<StudentInterventionTarget | null> {
	const canAccess = await teacherCanAccessStudentForSession(params.teacherId, params.studentId);
	if (!canAccess) return null;

	const scopedSubject =
		params.forcedRosterSubjectId ??
		(params.subjectId && params.subjectId !== "all" ? params.subjectId : null);

	const filters = [
		eq(performanceTracker.studentId, params.studentId),
		eq(topics.isActive, true),
		isNotNull(performanceTracker.averageScore),
		gt(performanceTracker.testsTaken, 0),
	];
	if (scopedSubject) {
		filters.push(eq(performanceTracker.subjectId, scopedSubject));
	}

	const rows = await db
		.select({
			subjectId: performanceTracker.subjectId,
			subjectName: subjects.name,
			topicId: performanceTracker.topicId,
			topicName: topics.topicName,
			averageScore: performanceTracker.averageScore,
			testsTaken: performanceTracker.testsTaken,
		})
		.from(performanceTracker)
		.innerJoin(topics, eq(topics.id, performanceTracker.topicId))
		.innerJoin(subjects, eq(subjects.id, performanceTracker.subjectId))
		.where(and(...filters));

	const weakTopicRows: WeakTopicRow[] = rows.flatMap((row) => {
		const averagePercent = row.averageScore == null ? Number.NaN : Number(row.averageScore);
		if (!Number.isFinite(averagePercent)) return [];
		return [
			{
				subjectId: row.subjectId,
				subjectName: row.subjectName,
				topicId: row.topicId,
				topicName: row.topicName,
				averagePercent,
				testsTaken: row.testsTaken ?? 0,
			},
		];
	});

	return selectInterventionTarget(weakTopicRows, { forcedSubjectId: scopedSubject });
}
