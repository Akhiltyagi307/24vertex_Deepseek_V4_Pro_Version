import "server-only";

import { and, desc, eq, gte, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";
import { questions, studentAnswers, testReports, tests } from "@/db/schema/assessment";
import { profiles } from "@/db/schema/profiles";

import {
	anomalyAiErrorAnswer,
	anomalyMissingAnswerKey,
	adminLiveTestAnomalyFlags,
	adminPracticeTestAnomalyFlags,
} from "@/lib/admin/anomalies";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type AdminTestListRow = {
	id: string;
	student_id: string;
	student_name: string | null;
	subject_id: string;
	subject_name: string | null;
	status: string | null;
	total_score: string | null;
	updated_at: Date | null;
	anomaly_flags: string[];
};

export async function adminListTests(input: {
	page: number;
	pageSize: number;
	status?: string | null;
	q?: string | null;
	/** When set, restrict to this student's tests (L2 user 360). */
	studentId?: string | null;
}): Promise<{ rows: AdminTestListRow[]; total: number }> {
	const pageSize = Math.min(100, Math.max(1, input.pageSize));
	const page = Math.max(1, input.page);
	const offset = (page - 1) * pageSize;

	const conditions = [];
	const sid = input.studentId?.trim();
	if (sid) {
		conditions.push(eq(tests.studentId, sid));
	}
	if (input.status) {
		conditions.push(eq(tests.status, input.status));
	}
	if (input.q && input.q.trim()) {
		const q = `%${input.q.trim()}%`;
		conditions.push(ilike(profiles.fullName, q));
	}
	const whereClause = conditions.length ? and(...conditions) : undefined;

	const countQ = db
		.select({ c: sql<number>`count(*)::int` })
		.from(tests)
		.leftJoin(profiles, eq(tests.studentId, profiles.id))
		.where(whereClause);
	const [{ c: total }] = await countQ;

	const base = db
		.select({
			id: tests.id,
			studentId: tests.studentId,
			studentName: profiles.fullName,
			subjectId: tests.subjectId,
			subjectName: subjects.name,
			status: tests.status,
			totalScore: tests.totalScore,
			updatedAt: tests.updatedAt,
			durationSeconds: tests.durationSeconds,
			timeLimitSeconds: tests.timeLimitSeconds,
		})
		.from(tests)
		.leftJoin(profiles, eq(tests.studentId, profiles.id))
		.leftJoin(subjects, eq(tests.subjectId, subjects.id))
		.where(whereClause)
		.orderBy(desc(tests.updatedAt))
		.limit(pageSize)
		.offset(offset);

	const raw = await base;
	const rows: AdminTestListRow[] = [];
	for (const r of raw) {
		const t = {
			durationSeconds: r.durationSeconds,
			timeLimitSeconds: r.timeLimitSeconds,
			totalScore: r.totalScore,
			status: r.status,
		};
		const flags = adminPracticeTestAnomalyFlags(t);
		rows.push({
			id: r.id,
			student_id: r.studentId,
			student_name: r.studentName,
			subject_id: r.subjectId,
			subject_name: r.subjectName,
			status: r.status,
			total_score: r.totalScore,
			updated_at: r.updatedAt,
			anomaly_flags: flags,
		});
	}

	return { rows, total: Number(total) || 0 };
}

export async function adminListLiveTests(): Promise<AdminTestListRow[]> {
	const cutoff = sql`now() - interval '5 minutes'`;
	const rows = await db
		.select({
			id: tests.id,
			studentId: tests.studentId,
			studentName: profiles.fullName,
			subjectId: tests.subjectId,
			subjectName: subjects.name,
			status: tests.status,
			totalScore: tests.totalScore,
			updatedAt: tests.updatedAt,
			durationSeconds: tests.durationSeconds,
			timeLimitSeconds: tests.timeLimitSeconds,
			tabBlurCount: tests.tabBlurCount,
			isPaused: tests.isPaused,
		})
		.from(tests)
		.leftJoin(profiles, eq(tests.studentId, profiles.id))
		.leftJoin(subjects, eq(tests.subjectId, subjects.id))
		.where(and(eq(tests.status, "in_progress"), gte(tests.updatedAt, cutoff)))
		.orderBy(desc(tests.updatedAt))
		.limit(200);

	return rows.map((r) => {
		const t = {
			durationSeconds: r.durationSeconds,
			timeLimitSeconds: r.timeLimitSeconds,
			totalScore: r.totalScore,
			status: r.status,
			tabBlurCount: r.tabBlurCount,
			isPaused: r.isPaused,
		};
		const flags = adminLiveTestAnomalyFlags(t);
		return {
			id: r.id,
			student_id: r.studentId,
			student_name: r.studentName,
			subject_id: r.subjectId,
			subject_name: r.subjectName,
			status: r.status,
			total_score: r.totalScore,
			updated_at: r.updatedAt,
			anomaly_flags: flags,
		};
	});
}

export async function adminLoadQuestionAnomalies(testId: string): Promise<{ questionId: string; flags: string[] }[]> {
	const qs = await db
		.select({
			id: questions.id,
			answerKey: questions.answerKey,
		})
		.from(questions)
		.where(eq(questions.testId, testId));

	const ans = await db
		.select({
			questionId: studentAnswers.questionId,
			aiFeedback: studentAnswers.aiFeedback,
		})
		.from(studentAnswers)
		.where(eq(studentAnswers.testId, testId));

	const ansByQ = new Map(ans.map((a) => [a.questionId, a]));

	const out: { questionId: string; flags: string[] }[] = [];
	for (const q of qs) {
		const flags: string[] = [];
		if (anomalyMissingAnswerKey({ answerKey: q.answerKey })) flags.push("no_answer_key");
		const a = ansByQ.get(q.id);
		if (a && anomalyAiErrorAnswer({ aiFeedback: a.aiFeedback })) flags.push("ai_error");
		if (flags.length) out.push({ questionId: q.id, flags });
	}
	return out;
}

export async function adminGetTestReport(testId: string) {
	const rows = await db.select().from(testReports).where(eq(testReports.testId, testId)).limit(1);
	return rows[0] ?? null;
}

export async function adminGetTestBundle(testId: string) {
	const admin = createServiceRoleClient();
	const { data: test, error: tErr } = await admin.from("tests").select("*").eq("id", testId).maybeSingle();
	if (tErr || !test) return null;
	const { data: questions } = await admin
		.from("questions")
		.select("*")
		.eq("test_id", testId)
		.order("question_number", { ascending: true });
	const { data: answers } = await admin.from("student_answers").select("*").eq("test_id", testId);
	const qAnomalies = await adminLoadQuestionAnomalies(testId);
	const report = await adminGetTestReport(testId);
	return { test, questions: questions ?? [], answers: answers ?? [], question_anomalies: qAnomalies, report };
}
