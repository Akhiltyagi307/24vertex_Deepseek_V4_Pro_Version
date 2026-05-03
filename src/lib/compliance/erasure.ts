import "server-only";

import { eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiCalls } from "@/db/schema/ai-calls";
import { adminTestMessages, performanceTracker, questionFlags, studentAnswers, testReports, tests } from "@/db/schema/assessment";
import { assignmentSubmissions } from "@/db/schema/teaching";
import { notifications, userPreferences } from "@/db/schema/comms-audit";
import { doubtConversations, doubtMessages } from "@/db/schema/doubt";
import { profiles, parentStudentLinks } from "@/db/schema/profiles";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Tables we never delete in compliance erasure (audit + billing law). */
export const ERASURE_PROTECTED_TABLES = ["admin_action_log", "audit_logs", "payments"] as const;

export type ErasureCounts = Record<string, number>;

async function loadTestIdsForStudent(userId: string): Promise<string[]> {
	const rows = await db.select({ id: tests.id }).from(tests).where(eq(tests.studentId, userId));
	return rows.map((r) => r.id);
}

/** SELECT-only counts for dry-run UI (PDR §4.23). */
export async function countErasureImpact(userId: string): Promise<ErasureCounts> {
	const testIds = await loadTestIdsForStudent(userId);
	const counts: ErasureCounts = { tests_retained: testIds.length };

	const [{ c: prof }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(profiles)
		.where(eq(profiles.id, userId));
	counts.profiles_to_anonymize = Number(prof ?? 0);

	if (testIds.length) {
		const [{ c: ans }] = await db
			.select({ c: sql<number>`count(*)::int` })
			.from(studentAnswers)
			.where(inArray(studentAnswers.testId, testIds));
		counts.student_answers_deleted = Number(ans ?? 0);
		const [{ c: rep }] = await db
			.select({ c: sql<number>`count(*)::int` })
			.from(testReports)
			.where(inArray(testReports.testId, testIds));
		counts.test_reports_deleted = Number(rep ?? 0);
		const [{ c: adm }] = await db
			.select({ c: sql<number>`count(*)::int` })
			.from(adminTestMessages)
			.where(inArray(adminTestMessages.testId, testIds));
		counts.admin_test_messages_deleted = Number(adm ?? 0);
	} else {
		counts.student_answers_deleted = 0;
		counts.test_reports_deleted = 0;
		counts.admin_test_messages_deleted = 0;
	}

	const [{ c: qf }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(questionFlags)
		.where(eq(questionFlags.studentId, userId));
	counts.question_flags_deleted = Number(qf ?? 0);

	const [{ c: perf }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(performanceTracker)
		.where(eq(performanceTracker.studentId, userId));
	counts.performance_tracker_deleted = Number(perf ?? 0);

	const [{ c: subm }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(assignmentSubmissions)
		.where(eq(assignmentSubmissions.studentId, userId));
	counts.assignment_submissions_deleted = Number(subm ?? 0);

	const [{ c: notif }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(notifications)
		.where(eq(notifications.recipientId, userId));
	counts.notifications_deleted = Number(notif ?? 0);

	const [{ c: pref }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId));
	counts.user_preferences_deleted = Number(pref ?? 0);

	const [{ c: links }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(parentStudentLinks)
		.where(or(eq(parentStudentLinks.parentId, userId), eq(parentStudentLinks.studentId, userId))!);
	counts.parent_student_links_deleted = Number(links ?? 0);

	const convos = await db.select({ id: doubtConversations.id }).from(doubtConversations).where(eq(doubtConversations.studentId, userId));
	const convoIds = convos.map((c) => c.id);
	if (convoIds.length) {
		const [{ c: dm }] = await db
			.select({ c: sql<number>`count(*)::int` })
			.from(doubtMessages)
			.where(inArray(doubtMessages.conversationId, convoIds));
		counts.doubt_messages_deleted = Number(dm ?? 0);
	} else counts.doubt_messages_deleted = 0;
	counts.doubt_conversations_deleted = convoIds.length;

	const [{ c: ai }] = await db.select({ c: sql<number>`count(*)::int` }).from(aiCalls).where(eq(aiCalls.userId, userId));
	counts.ai_calls_deleted = Number(ai ?? 0);

	return counts;
}

/**
 * Applies compliance erasure for a subject user. Dry-run returns counts only.
 * Retains `tests` / `questions` rows (FERPA), `payments`, `audit_logs`, `admin_action_log`.
 */
export async function performComplianceErasure(userId: string, opts: { dryRun: boolean }): Promise<ErasureCounts> {
	const snapshot = await countErasureImpact(userId);
	if (opts.dryRun) {
		return snapshot;
	}

	const testIds = await loadTestIdsForStudent(userId);
	const convoIds = (
		await db.select({ id: doubtConversations.id }).from(doubtConversations).where(eq(doubtConversations.studentId, userId))
	).map((c) => c.id);

	await db.transaction(async (tx) => {
		if (testIds.length) {
			await tx.delete(studentAnswers).where(inArray(studentAnswers.testId, testIds));
			await tx.delete(testReports).where(inArray(testReports.testId, testIds));
			await tx.delete(adminTestMessages).where(inArray(adminTestMessages.testId, testIds));
		}
		await tx.delete(questionFlags).where(eq(questionFlags.studentId, userId));
		await tx.delete(performanceTracker).where(eq(performanceTracker.studentId, userId));
		await tx.delete(assignmentSubmissions).where(eq(assignmentSubmissions.studentId, userId));
		await tx.delete(notifications).where(eq(notifications.recipientId, userId));
		await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
		await tx
			.delete(parentStudentLinks)
			.where(or(eq(parentStudentLinks.parentId, userId), eq(parentStudentLinks.studentId, userId))!);
		if (convoIds.length) {
			await tx.delete(doubtMessages).where(inArray(doubtMessages.conversationId, convoIds));
			await tx.delete(doubtConversations).where(eq(doubtConversations.studentId, userId));
		}
		await tx.delete(aiCalls).where(eq(aiCalls.userId, userId));

		const now = new Date();
		await tx
			.update(profiles)
			.set({
				fullName: "Erased User",
				parentName: null,
				parentEmail: null,
				avatarUrl: null,
				bio: null,
				phone: null,
				website: null,
				schoolName: null,
				deletedAt: now,
				updatedAt: now,
			})
			.where(eq(profiles.id, userId));
	});

	const auth = createServiceRoleClient().auth.admin;
	const pseudoEmail = `erased+${userId.replace(/-/g, "").slice(0, 12)}@eduai.invalid`;
	const { error: authErr } = await auth.updateUserById(userId, { email: pseudoEmail });
	if (authErr) {
		throw new Error(`Auth pseudonymize failed: ${authErr.message}`);
	}

	return snapshot;
}
