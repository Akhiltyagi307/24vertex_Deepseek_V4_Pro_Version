import "server-only";

import archiver from "archiver";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import { eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { aiCalls } from "@/db/schema/ai-calls";
import { adminActionLog } from "@/db/schema/admin-action-log";
import { adminTestMessages, performanceTracker, questionFlags, questions, studentAnswers, testReports, tests } from "@/db/schema/assessment";
import { assignmentSubmissions } from "@/db/schema/teaching";
import { couponRedemptions, freeTrialClaims, payments, subscriptions, usagePeriods } from "@/db/schema/billing";
import { complianceRequests } from "@/db/schema/compliance-requests";
import { auditLogs, emailLog, notifications, userPreferences } from "@/db/schema/comms-audit";
import { doubtConversations, doubtMessageAttachments, doubtMessages } from "@/db/schema/doubt";
import { parentalConsents } from "@/db/schema/parental-consents";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { userFeedbackReports } from "@/db/schema/user-feedback-reports";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Signed URLs included in the export are valid for 7 days. Long enough for
 * the user to download, short enough that an export ZIP leaked years later
 * doesn't unlock storage objects.
 */
const ATTACHMENT_DOWNLOAD_TTL_SECONDS = 60 * 60 * 24 * 7;

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export type ComplianceExportManifest = Record<string, number>;

/**
 * Builds a ZIP of JSON slices for one subject user (PDR §4.23 / implementation plan table list).
 */
export async function buildComplianceExportZip(input: {
	subjectUserId: string;
	complianceRequestId: string;
}): Promise<{ buffer: Buffer; manifest: ComplianceExportManifest }> {
	const userId = input.subjectUserId;
	const manifest: ComplianceExportManifest = {};

	const profileRows = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(500);
	const perfRows = await db.select().from(performanceTracker).where(eq(performanceTracker.studentId, userId)).limit(50_000);
	const testRows = await db.select().from(tests).where(eq(tests.studentId, userId)).limit(50_000);
	const testIds = testRows.map((t) => t.id);

	let questionRows: (typeof questions.$inferSelect)[] = [];
	let answerRows: (typeof studentAnswers.$inferSelect)[] = [];
	let reportRows: (typeof testReports.$inferSelect)[] = [];
	let adminMsgRows: (typeof adminTestMessages.$inferSelect)[] = [];
	if (testIds.length) {
		questionRows = await db.select().from(questions).where(inArray(questions.testId, testIds)).limit(500_000);
		answerRows = await db.select().from(studentAnswers).where(inArray(studentAnswers.testId, testIds)).limit(500_000);
		reportRows = await db.select().from(testReports).where(eq(testReports.studentId, userId)).limit(50_000);
		adminMsgRows = await db.select().from(adminTestMessages).where(inArray(adminTestMessages.testId, testIds)).limit(20_000);
	}

	const qFlagRows = await db.select().from(questionFlags).where(eq(questionFlags.studentId, userId)).limit(50_000);
	const feedbackRows = await db
		.select()
		.from(userFeedbackReports)
		.where(eq(userFeedbackReports.userId, userId))
		.limit(10_000);
	const submissionRows = await db
		.select()
		.from(assignmentSubmissions)
		.where(eq(assignmentSubmissions.studentId, userId))
		.limit(50_000);
	const notifRows = await db.select().from(notifications).where(eq(notifications.recipientId, userId)).limit(50_000);
	const prefRows = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(100);
	const linkRows = await db
		.select()
		.from(parentStudentLinks)
		.where(or(eq(parentStudentLinks.parentId, userId), eq(parentStudentLinks.studentId, userId)))
		.limit(10_000);
	const subRows = await db.select().from(subscriptions).where(eq(subscriptions.profileId, userId)).limit(500);
	const subIds = subRows.map((s) => s.id);
	let usageRows: (typeof usagePeriods.$inferSelect)[] = [];
	if (subIds.length) {
		usageRows = await db.select().from(usagePeriods).where(inArray(usagePeriods.subscriptionId, subIds)).limit(10_000);
	}
	const paymentRows = await db.select().from(payments).where(eq(payments.profileId, userId)).limit(50_000);
	const redemptionRows = await db.select().from(couponRedemptions).where(eq(couponRedemptions.profileId, userId)).limit(10_000);
	const trialRows = await db.select().from(freeTrialClaims).where(eq(freeTrialClaims.firstProfileId, userId)).limit(100);
	const auditRows = await db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).limit(100_000);
	const adminLogRows = await db.select().from(adminActionLog).where(eq(adminActionLog.targetId, userId)).limit(50_000);
	const consentRows = await db.select().from(parentalConsents).where(eq(parentalConsents.studentId, userId)).limit(1000);
	const dsrRows = await db
		.select()
		.from(complianceRequests)
		.where(
			or(eq(complianceRequests.subjectUserId, userId), eq(complianceRequests.id, input.complianceRequestId))!,
		)
		.limit(1000);
	const emailRows = await db.select().from(emailLog).where(eq(emailLog.recipientId, userId)).limit(50_000);
	const aiRows = await db.select().from(aiCalls).where(eq(aiCalls.userId, userId)).limit(100_000);
	const doubtConvos = await db.select().from(doubtConversations).where(eq(doubtConversations.studentId, userId)).limit(10_000);
	const convoIds = doubtConvos.map((c) => c.id);
	let doubtMsgRows: (typeof doubtMessages.$inferSelect)[] = [];
	let doubtAttRows: (typeof doubtMessageAttachments.$inferSelect)[] = [];
	if (convoIds.length) {
		doubtMsgRows = await db.select().from(doubtMessages).where(inArray(doubtMessages.conversationId, convoIds)).limit(200_000);
		doubtAttRows = await db
			.select()
			.from(doubtMessageAttachments)
			.where(inArray(doubtMessageAttachments.conversationId, convoIds))
			.limit(50_000);
	}

	// Build signed download URLs for each attachment so the export ZIP gives
	// the user a real way to retrieve their uploaded files (GDPR data
	// portability). URLs valid for 7 days; failure on any individual row is
	// recorded so the user can see which files we couldn't sign.
	type AttachmentDownload = {
		attachment_id: string;
		conversation_id: string;
		message_id: string | null;
		kind: string;
		mime: string;
		size_bytes: number;
		storage_path: string;
		download_url: string | null;
		expires_at: string | null;
		error: string | null;
	};
	const attachmentDownloads: AttachmentDownload[] = [];
	if (doubtAttRows.length > 0) {
		const supabase = createServiceRoleClient();
		const expiresAt = new Date(Date.now() + ATTACHMENT_DOWNLOAD_TTL_SECONDS * 1000).toISOString();
		for (const row of doubtAttRows) {
			const path = row.storagePath as string;
			const { data, error } = await supabase.storage
				.from("doubt-attachments")
				.createSignedUrl(path, ATTACHMENT_DOWNLOAD_TTL_SECONDS);
			attachmentDownloads.push({
				attachment_id: row.id,
				conversation_id: row.conversationId,
				message_id: row.messageId ?? null,
				kind: row.kind,
				mime: row.mime,
				size_bytes: row.sizeBytes,
				storage_path: path,
				download_url: data?.signedUrl ?? null,
				expires_at: data?.signedUrl ? expiresAt : null,
				error: error?.message ?? null,
			});
		}
	}

	const slices: { name: string; rows: unknown[] }[] = [
		{ name: "profiles.json", rows: profileRows },
		{ name: "performance_tracker.json", rows: perfRows },
		{ name: "tests.json", rows: testRows },
		{ name: "questions.json", rows: questionRows },
		{ name: "student_answers.json", rows: answerRows },
		{ name: "test_reports.json", rows: reportRows },
		{ name: "admin_test_messages.json", rows: adminMsgRows },
		{ name: "question_flags.json", rows: qFlagRows },
		{ name: "user_feedback_reports.json", rows: feedbackRows },
		{ name: "assignment_submissions.json", rows: submissionRows },
		{ name: "notifications.json", rows: notifRows },
		{ name: "user_preferences.json", rows: prefRows },
		{ name: "parent_student_links.json", rows: linkRows },
		{ name: "subscriptions.json", rows: subRows },
		{ name: "usage_periods.json", rows: usageRows },
		{ name: "payments.json", rows: paymentRows },
		{ name: "coupon_redemptions.json", rows: redemptionRows },
		{ name: "free_trial_claims.json", rows: trialRows },
		{ name: "audit_logs.json", rows: auditRows },
		{ name: "admin_action_log.json", rows: adminLogRows },
		{ name: "parental_consents.json", rows: consentRows },
		{ name: "compliance_requests.json", rows: dsrRows },
		{ name: "email_log.json", rows: emailRows },
		{ name: "ai_calls.json", rows: aiRows },
		{ name: "doubt_conversations.json", rows: doubtConvos },
		{ name: "doubt_messages.json", rows: doubtMsgRows },
		{ name: "doubt_message_attachments.json", rows: doubtAttRows },
		{ name: "doubt_attachments_downloads.json", rows: attachmentDownloads },
	];

	for (const s of slices) {
		manifest[s.name] = s.rows.length;
	}
	manifest["index.html"] = 1;

	const generatedAt = new Date().toISOString();
	const indexRows = Object.entries(manifest).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`);
	const indexHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Data export</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}</style>
</head><body><h1>Subject data export</h1><p>User id: ${escapeHtml(userId)}</p><p>Generated: ${escapeHtml(generatedAt)}</p>
<p>Request: ${escapeHtml(input.complianceRequestId)}</p><table><thead><tr><th>File</th><th>Rows</th></tr></thead><tbody>${indexRows.join("")}</tbody></table></body></html>`;

	const files: { name: string; content: string }[] = slices.map((s) => ({
		name: s.name,
		content: JSON.stringify(s.rows, null, 2),
	}));
	files.push({ name: "index.html", content: indexHtml });

	const passthrough = new PassThrough();
	const chunks: Buffer[] = [];
	passthrough.on("data", (c: Buffer) => chunks.push(c));

	const archive = archiver("zip", { zlib: { level: 6 } });
	archive.pipe(passthrough);

	for (const f of files) {
		archive.append(f.content, { name: f.name });
	}

	const done = finished(passthrough).then(() => Buffer.concat(chunks));
	await archive.finalize();
	const buffer = await done;
	return { buffer, manifest };
}
