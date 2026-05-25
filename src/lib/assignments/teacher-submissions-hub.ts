import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { subjects, topics } from "@/db/schema/academic";
import { testReports, tests } from "@/db/schema/assessment";
import { assignments, assignmentSubmissions } from "@/db/schema/teaching";
import type { TrackerTopicStatus } from "@/lib/practice/topic-rollup";

import { listTeacherAssignmentSubmissionRows, type TeacherAssignmentSubmissionRow } from "./queries";
import { assignmentConfigSchema } from "./schemas";
import type {
	StudentSubmissionPerfRow,
	TeacherSubmissionAssignmentBundle,
	TopicSubmissionAggRow,
} from "./teacher-submissions-hub-types";

export type {
	StudentSubmissionPerfRow,
	TeacherSubmissionAssignmentBundle,
	TopicSubmissionAggRow,
} from "./teacher-submissions-hub-types";

const HANDED_IN_STATUSES = new Set(["submitted", "grading", "graded"]);

type StoredTopicPerfTopic = {
	topic_id?: string;
	topic_name?: string;
	average_score?: number;
	status?: string;
};

type StoredTopicPerf = {
	schema_version?: number;
	topics?: StoredTopicPerfTopic[];
};

type SummaryReportJson = {
	schema_version?: number;
	overall_percent?: number;
};

function parseTopicPerformance(raw: unknown): StoredTopicPerf | null {
	if (!raw || typeof raw !== "object") return null;
	return raw as StoredTopicPerf;
}

function parseSummaryReport(raw: unknown): SummaryReportJson | null {
	if (!raw || typeof raw !== "object") return null;
	return raw as SummaryReportJson;
}

function normalizeTrackerStatus(raw: string | undefined): TrackerTopicStatus | null {
	if (raw === "good" || raw === "satisfactory" || raw === "bad") return raw;
	return null;
}

function formatSectionsLabel(rows: TeacherAssignmentSubmissionRow[]): string {
	const seen = new Set<string>();
	for (const r of rows) {
		const s = (r.studentSection ?? "").trim();
		if (s) seen.add(s);
	}
	if (seen.size === 0) return "—";
	return [...seen].sort((a, b) => a.localeCompare(b)).join(" · ");
}

export async function loadTeacherSubmissionAssignmentBundles(
	teacherId: string,
): Promise<TeacherSubmissionAssignmentBundle[]> {
	const submissions = await listTeacherAssignmentSubmissionRows(teacherId);
	if (submissions.length === 0) return [];

	const assignmentIds = [...new Set(submissions.map((s) => s.assignmentId))];
	const testIds = [
		...new Set(
			submissions.map((s) => s.testId).filter((id): id is string => typeof id === "string" && id.length > 0),
		),
	];

	type ReportPick = {
		testId: string;
		topicPerformance: unknown;
		summaryReport: unknown;
	};

	const assignmentMetaRowsPromise = db
		.select({
			id: assignments.id,
			title: assignments.title,
			dueAt: assignments.dueAt,
			createdAt: assignments.createdAt,
			config: assignments.config,
		})
		.from(assignments)
		.where(and(eq(assignments.teacherId, teacherId), inArray(assignments.id, assignmentIds)));

	const reportsPromise =
		testIds.length > 0 ?
			db
				.select({
					testId: testReports.testId,
					topicPerformance: testReports.topicPerformance,
					summaryReport: testReports.summaryReport,
				})
				.from(testReports)
				.where(inArray(testReports.testId, testIds))
		:	Promise.resolve([] as ReportPick[]);

	const [assignmentMetaRows, reports] = await Promise.all([assignmentMetaRowsPromise, reportsPromise]);

	const metaById = new Map(
		assignmentMetaRows.map((row) => {
			const parsed = assignmentConfigSchema.safeParse(row.config);
			return [
				row.id,
				{
					title: row.title,
					dueAt: row.dueAt,
					createdAt: row.createdAt,
					config: parsed.success ? parsed.data : null,
				},
			];
		}),
	);

	const subjectIds = [
		...new Set(
			assignmentMetaRows.flatMap((row) => {
				const parsed = assignmentConfigSchema.safeParse(row.config);
				return parsed.success ? [parsed.data.subject_id] : [];
			}),
		),
	];

	const subjectGradeRows =
		subjectIds.length > 0 ?
			await db
				.select({ id: subjects.id, grade: subjects.grade, name: subjects.name })
				.from(subjects)
				.where(inArray(subjects.id, subjectIds))
		:	[];

	const subjectGradeById = new Map(subjectGradeRows.map((s) => [s.id, s.grade]));

	const reportByTestId = new Map(
		reports.map((r) => [
			r.testId,
			{
				topicPerf: parseTopicPerformance(r.topicPerformance),
				summary: parseSummaryReport(r.summaryReport),
			},
		]),
	);

	const allTopicIds = new Set<string>();
	for (const row of assignmentMetaRows) {
		const parsed = assignmentConfigSchema.safeParse(row.config);
		if (!parsed.success) continue;
		for (const tid of parsed.data.topic_ids) {
			allTopicIds.add(tid);
		}
	}

	const topicNameById = new Map<string, string>();
	if (allTopicIds.size > 0) {
		const topicRows = await db
			.select({ id: topics.id, topicName: topics.topicName })
			.from(topics)
			.where(inArray(topics.id, [...allTopicIds]));
		for (const t of topicRows) {
			topicNameById.set(t.id, t.topicName);
		}
	}

	const bundles: TeacherSubmissionAssignmentBundle[] = [];

	const grouped = new Map<string, TeacherAssignmentSubmissionRow[]>();
	for (const s of submissions) {
		const list = grouped.get(s.assignmentId) ?? [];
		list.push(s);
		grouped.set(s.assignmentId, list);
	}

	const orderedIds = assignmentIds.slice().sort((a, b) => {
		const ca = metaById.get(a)?.createdAt?.getTime?.() ?? 0;
		const cb = metaById.get(b)?.createdAt?.getTime?.() ?? 0;
		return cb - ca;
	});

	for (const assignmentId of orderedIds) {
		const rows = grouped.get(assignmentId);
		if (!rows?.length) continue;

		const meta = metaById.get(assignmentId);
		const cfg = meta?.config ?? null;
		const subjectId = cfg?.subject_id ?? null;

		const subjectGrade =
			subjectId ? subjectGradeById.get(subjectId) ?? rows[0]?.studentGrade ?? null : rows[0]?.studentGrade ?? null;

		const subjectName = rows[0]?.subjectName ?? null;
		const title = meta?.title ?? rows[0]?.assignmentTitle ?? "Assignment";
		const dueAt = meta?.dueAt ? meta.dueAt.toISOString() : rows[0]?.dueAt ?? null;
		const createdAt = meta?.createdAt ? meta.createdAt.toISOString() : rows[0]?.createdAt ?? null;

		const assigned = rows.length;
		const submitted = rows.filter((r) => HANDED_IN_STATUSES.has(r.lifecycleStatus)).length;
		const notSubmitted = Math.max(0, assigned - submitted);

		const topicIdsOrdered = cfg?.topic_ids ?? [];

		const gradedRows = rows.filter((r) => r.lifecycleStatus === "graded" && r.testId);

		const topicAnalytics: TopicSubmissionAggRow[] = [];

		for (const topicId of topicIdsOrdered) {
			let scoreSum = 0;
			let scoreN = 0;
			let badCount = 0;
			let satisfactoryCount = 0;
			let goodCount = 0;
			let sampleStudents = 0;
			const badStudents: TopicSubmissionAggRow["badStudents"] = [];
			const satisfactoryStudents: TopicSubmissionAggRow["satisfactoryStudents"] = [];
			const goodStudents: TopicSubmissionAggRow["goodStudents"] = [];

			for (const sub of gradedRows) {
				const pack = reportByTestId.get(sub.testId!);
				const tp = pack?.topicPerf;
				const hit = tp?.topics?.find((t) => t.topic_id === topicId);
				if (!hit) continue;
				sampleStudents += 1;
				const avg = Number(hit.average_score);
				const averagePercent = Number.isFinite(avg) ? avg : 0;
				if (Number.isFinite(avg)) {
					scoreSum += avg;
					scoreN += 1;
				}
				const st = normalizeTrackerStatus(hit.status);
				const studentEntry = {
					studentId: sub.studentId,
					fullName: sub.studentFullName,
					averagePercent,
				};
				if (st === "bad") {
					badCount += 1;
					badStudents.push(studentEntry);
				} else if (st === "satisfactory") {
					satisfactoryCount += 1;
					satisfactoryStudents.push(studentEntry);
				} else if (st === "good") {
					goodCount += 1;
					goodStudents.push(studentEntry);
				}
			}

			const sortBandStudents = (list: TopicSubmissionAggRow["badStudents"]) =>
				[...list].sort(
					(a, b) => a.averagePercent - b.averagePercent || a.fullName.localeCompare(b.fullName),
				);

			const topicName = topicNameById.get(topicId) ?? hitTopicNameFallback(gradedRows, topicId, reportByTestId);

			topicAnalytics.push({
				topicId,
				topicName,
				cumulativePercent: scoreN > 0 ? scoreSum / scoreN : null,
				badCount,
				satisfactoryCount,
				goodCount,
				sampleStudents,
				badStudents: sortBandStudents(badStudents),
				satisfactoryStudents: sortBandStudents(satisfactoryStudents),
				goodStudents: sortBandStudents(goodStudents),
			});
		}

		const studentsPerformance: StudentSubmissionPerfRow[] = rows.map((r) => {
			let previewOverallPercent: number | null = null;
			const previewTopics: StudentSubmissionPerfRow["previewTopics"] = [];

			if (r.testId) {
				const pack = reportByTestId.get(r.testId);
				const overall = pack?.summary?.overall_percent;
				if (typeof overall === "number" && Number.isFinite(overall)) {
					previewOverallPercent = overall;
				} else if (r.score != null && r.score !== "") {
					const p = Number(r.score);
					previewOverallPercent = Number.isFinite(p) ? p : null;
				}

				const tp = pack?.topicPerf?.topics ?? [];
				for (const t of tp) {
					const tid = t.topic_id;
					if (!tid) continue;
					const name =
						topicNameById.get(tid) ?? (typeof t.topic_name === "string" ? t.topic_name : tid.slice(0, 8));
					const avg = Number(t.average_score);
					const st = normalizeTrackerStatus(t.status);
					if (!st) continue;
					previewTopics.push({
						topicName: name,
						averagePercent: Number.isFinite(avg) ? avg : 0,
						status: st,
					});
				}
			}

			const scorePercent = r.score != null && r.score !== "" && Number.isFinite(Number(r.score)) ? Number(r.score) : null;

			return {
				studentId: r.studentId,
				studentFullName: r.studentFullName,
				studentGrade: r.studentGrade,
				studentSection: r.studentSection,
				lifecycleStatus: r.lifecycleStatus,
				scorePercent,
				testId: r.testId,
				previewOverallPercent,
				previewTopics,
			};
		});

		studentsPerformance.sort((a, b) => a.studentFullName.localeCompare(b.studentFullName));

		bundles.push({
			assignmentId,
			title,
			dueAt,
			createdAt,
			subjectId,
			subjectName,
			subjectGrade,
			sectionsLabel: formatSectionsLabel(rows),
			submissions: rows,
			counts: { assigned, submitted, notSubmitted },
			topicAnalytics,
			studentsPerformance,
		});
	}

	return bundles;
}

function hitTopicNameFallback(
	gradedRows: TeacherAssignmentSubmissionRow[],
	topicId: string,
	reportByTestId: Map<
		string,
		{
			topicPerf: StoredTopicPerf | null;
			summary: SummaryReportJson | null;
		}
	>,
): string {
	for (const sub of gradedRows) {
		const hit = reportByTestId.get(sub.testId!)?.topicPerf?.topics?.find((t) => t.topic_id === topicId);
		if (hit?.topic_name?.trim()) return hit.topic_name.trim();
	}
	return topicId.slice(0, 8);
}

/** Drizzle guard for teacher-owned assignment submissions tied to a test (practice PDF access). */
export async function teacherOwnsAssignmentTest(teacherId: string, testId: string): Promise<boolean> {
	const row = await db
		.select({ id: assignmentSubmissions.id })
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
		.innerJoin(
			tests,
			and(
				eq(tests.id, testId),
				eq(tests.studentId, assignmentSubmissions.studentId),
				or(
					eq(assignmentSubmissions.testId, tests.id),
					eq(tests.assignmentSubmissionId, assignmentSubmissions.id),
				),
			),
		)
		.where(eq(assignments.teacherId, teacherId))
		.limit(1);
	return row.length > 0;
}
