import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { subjects, topics } from "@/db/schema/academic";
import { performanceTracker } from "@/db/schema/assessment";
import { nIncorrectFromStatus } from "@/lib/admin/performance-status-map";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type TopicPerf = { topic_id: string; average_score: number; status: string };

export async function adminListPerformanceRows(studentId: string) {
	return db
		.select({
			id: performanceTracker.id,
			topicId: performanceTracker.topicId,
			subjectId: performanceTracker.subjectId,
			status: performanceTracker.status,
			averageScore: performanceTracker.averageScore,
			testsTaken: performanceTracker.testsTaken,
			trend: performanceTracker.trend,
			topicName: topics.topicName,
			subjectName: subjects.name,
		})
		.from(performanceTracker)
		.innerJoin(topics, eq(performanceTracker.topicId, topics.id))
		.innerJoin(subjects, eq(performanceTracker.subjectId, subjects.id))
		.where(eq(performanceTracker.studentId, studentId));
}

/** Deletes tracker rows and re-seeds from curriculum (same RPC family as student sync). */
export async function adminReinitializePerformanceTracker(studentId: string): Promise<{ ok: true } | { ok: false; message: string }> {
	const admin = createServiceRoleClient();
	const { error } = await admin.rpc("sync_student_performance_tracker_for_student", {
		p_student_id: studentId,
		p_reset_curriculum: true,
	});
	if (error) {
		logSupabaseError("adminReinitializePerformanceTracker.rpc", error, { studentId });
		return { ok: false, message: error.message };
	}
	const { error: e2 } = await admin.rpc("sync_student_performance_tracker_for_student", {
		p_student_id: studentId,
		p_reset_curriculum: false,
	});
	if (e2) {
		logSupabaseError("adminReinitializePerformanceTracker.rpc2", e2, { studentId });
		return { ok: false, message: e2.message };
	}
	return { ok: true };
}

/**
 * Re-applies `practice_update_trackers_bulk` from the latest graded test report per subject.
 * Idempotent for a fixed DB snapshot (same inputs → same tracker writes).
 */
export async function adminRecalculatePerformanceFromReports(studentId: string): Promise<{ ok: true } | { ok: false; message: string }> {
	const admin = createServiceRoleClient();
	const { data: tests, error: tErr } = await admin
		.from("tests")
		.select("id, subject_id, status, updated_at")
		.eq("student_id", studentId)
		.eq("status", "graded")
		.order("updated_at", { ascending: false })
		.limit(80);

	if (tErr) {
		return { ok: false, message: tErr.message };
	}
	if (!tests?.length) {
		return { ok: true };
	}

	const latestBySubject = new Map<string, string>();
	for (const row of tests) {
		const sid = row.subject_id as string;
		if (!latestBySubject.has(sid)) {
			latestBySubject.set(sid, row.id as string);
		}
	}

	for (const [subjectId, testId] of latestBySubject) {
		const { data: report, error: rErr } = await admin
			.from("test_reports")
			.select("topic_performance")
			.eq("test_id", testId)
			.maybeSingle();
		if (rErr || !report?.topic_performance) continue;

		const topics = (report.topic_performance as { topics?: TopicPerf[] } | null)?.topics ?? [];
		if (!topics.length) continue;

		const items = topics.map((t) => ({
			topic_id: t.topic_id,
			average_score: t.average_score,
			n_incorrect: nIncorrectFromStatus(String(t.status)),
		}));

		const { error: bErr } = await admin.rpc("practice_update_trackers_bulk", {
			p_student_id: studentId,
			p_subject_id: subjectId,
			p_current_test_id: testId,
			p_now: new Date().toISOString(),
			p_items: items,
		});
		if (bErr) {
			logSupabaseError("adminRecalculatePerformanceFromReports.bulk", bErr, { studentId, subjectId, testId });
			return { ok: false, message: bErr.message };
		}
	}

	return { ok: true };
}
