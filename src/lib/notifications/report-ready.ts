import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { notifications } from "@/db/schema/comms-audit";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { sendParentPortalReportReadyEmail, sendReportReadyEmail } from "@/lib/email/notifications-emails";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import {
	findNotificationIdForEmailRef,
	insertInAppNotification,
	markNotificationEmailSent,
} from "@/lib/notifications/insert";
import { getNotificationPrefs, isEmailAllowed } from "@/lib/notifications/prefs";
import { logServerError } from "@/lib/server/log-supabase-error";
import { createStudentTestReportPdfSignedUrl } from "@/lib/practice/student-test-report-pdf-signed-url";

export type NotifyTestReportReadyInput = {
	studentId: string;
	testId: string;
	subjectName: string;
	overallPercent: number | null;
};

/**
 * Has a `test_report_ready` notification already been written for
 * (recipient × test)? Used by both the student and parent in-app emit so
 * grading retries / overlapping submit + worker calls don't duplicate cards.
 */
async function hasExistingReportReadyRow(recipientId: string, testId: string): Promise<boolean> {
	try {
		const rows = await db
			.select({ id: notifications.id })
			.from(notifications)
			.where(
				and(
					eq(notifications.recipientId, recipientId),
					eq(notifications.referenceType, "test"),
					eq(notifications.referenceId, testId),
					eq(notifications.category, "test_report_ready"),
				),
			)
			.limit(1);
		return rows.length > 0;
	} catch (err) {
		logServerError("notifications.report_ready.dedup_check", err, { recipientId, testId });
		// Fail-closed: skip insert when we can't verify, so we don't risk dups.
		return true;
	}
}

/**
 * Emits the "your report is ready" in-app notification after grading finishes.
 *
 * Idempotency contract — both halves below are checked against the
 * `notifications` table by `(recipientId, referenceType=test, referenceId,
 * category=test_report_ready)`, so:
 *
 *  - Student emit: dedup check → insert (or skip).
 *  - Parent emit:  per-parent dedup check → insert (or skip) for each linked parent.
 *
 * The two halves are independent on purpose: a parent emit failure must NOT
 * cause the student emit to retry (and vice versa). On any retry, both halves
 * re-run their dedup checks and only insert rows that don't yet exist —
 * which is correct behavior, not desync. Do not "unify" by sharing a single
 * dedup row across roles; the bell UI keys by recipient.
 *
 * Report-ready emails (student + linked parents) are sent from the email job
 * (`handleEmailJob` in `app/api/internal/practice/run-jobs/route.ts`) with a
 * Supabase signed URL so recipients can open the PDF without EduAI login.
 */
export async function notifyTestReportReady(input: NotifyTestReportReadyInput): Promise<void> {
	try {
		if (!(await hasExistingReportReadyRow(input.studentId, input.testId))) {
			const prefs = await getNotificationPrefs(input.studentId);
			await insertInAppNotification({
				recipientId: input.studentId,
				title: `Your ${input.subjectName} report is ready`,
				body: buildReportBody(input),
				type: "test_result",
				category: "test_report_ready",
				referenceType: "test",
				referenceId: input.testId,
				prefs,
			});
		}
	} catch (err) {
		logServerError("notifications.report_ready", err, {
			studentId: input.studentId,
			testId: input.testId,
		});
	}

	// Parent emit runs even if the student emit failed — its own dedup check
	// keeps it idempotent. Errors here only log, never throw to the grader.
	try {
		await notifyLinkedParentsTestReportReadyInApp(input);
	} catch (err) {
		logServerError("notifications.report_ready.parent_emit", err, {
			studentId: input.studentId,
			testId: input.testId,
		});
	}
}

async function notifyLinkedParentsTestReportReadyInApp(input: NotifyTestReportReadyInput): Promise<void> {
	const linkRows = await db
		.select({ parentId: parentStudentLinks.parentId })
		.from(parentStudentLinks)
		.where(and(eq(parentStudentLinks.studentId, input.studentId), eq(parentStudentLinks.status, "active")));

	if (linkRows.length === 0) return;

	const contact = await loadProfileContact(input.studentId);
	const childLabel = formatPersonDisplayName(contact?.fullName ?? "") || "your child";

	// Fan out across parents in parallel; each task swallows its own errors so
	// one parent's failure never starves another. `Promise.allSettled` waits
	// for every task before this function resolves.
	await Promise.allSettled(
		linkRows.map(async ({ parentId }) => {
			try {
				if (await hasExistingReportReadyRow(parentId, input.testId)) return;
				const prefs = await getNotificationPrefs(parentId);
				await insertInAppNotification({
					recipientId: parentId,
					title: `${childLabel} — ${input.subjectName} report ready`,
					body: buildParentPortalReportBody(input, childLabel),
					type: "test_result",
					category: "test_report_ready",
					referenceType: "test",
					referenceId: input.testId,
					contextStudentId: input.studentId,
					prefs,
				});
			} catch (err) {
				logServerError("notifications.report_ready.parent_in_app", err, {
					parentId,
					studentId: input.studentId,
					testId: input.testId,
				});
			}
		}),
	);
}

export type NotifyTestReportPdfReadyEmailsInput = {
	testId: string;
	studentId: string;
	subjectName: string;
	overallPercent: number | null;
	storagePath: string;
};

/**
 * Aggregated email-send result. `permanentlyFailed` is set when the
 * underlying issue cannot be retried (e.g., null storage path) so the
 * caller can mark the queue job dead immediately instead of retrying
 * indefinitely.
 */
export type NotifyTestReportPdfReadyEmailsResult =
	| { ok: true; sent: number }
	| { ok: false; sent: number; failedCount: number; permanentlyFailed: boolean; reason: string };

/**
 * Sends student + parent "report ready" emails after the PDF is in Storage.
 * Uses a time-limited signed URL so the PDF opens without EduAI authentication.
 *
 * Idempotency: `sendHtmlEmailLogged` is called with a `dedupKey` per recipient
 * (`report-ready:${testId}:${student|parent}:${recipientId}`) so concurrent
 * grading retries do not produce duplicate sends.
 */
export async function notifyTestReportPdfReadyEmails(
	input: NotifyTestReportPdfReadyEmailsInput,
): Promise<NotifyTestReportPdfReadyEmailsResult> {
	if (!input.storagePath) {
		// Permanently terminal: there's no PDF to attach. Caller should NOT
		// retry — the upstream PDF render didn't complete. We still report
		// because the queue job needs to know to mark itself dead.
		return {
			ok: false,
			sent: 0,
			failedCount: 0,
			permanentlyFailed: true,
			reason: "missing_storage_path",
		};
	}
	let sent = 0;
	let failedCount = 0;
	try {
		const signed = await createStudentTestReportPdfSignedUrl(input.storagePath);
		if (!signed.ok) {
			logServerError("notifications.report_pdf_ready.signed_url", new Error(signed.message), {
				testId: input.testId,
				studentId: input.studentId,
			});
			return {
				ok: false,
				sent: 0,
				failedCount: 0,
				permanentlyFailed: false,
				reason: signed.message,
			};
		}
		const pdfSignedUrl = signed.url;

		const studentContact = await loadProfileContact(input.studentId);
		const childLabel = formatPersonDisplayName(studentContact?.fullName ?? "") || "your child";

		const studentPrefs = await getNotificationPrefs(input.studentId);
		if (isEmailAllowed(studentPrefs, "test_result") && studentContact?.email) {
			const { error } = await sendReportReadyEmail({
				to: studentContact.email,
				recipientUserId: input.studentId,
				studentName: studentContact.fullName ?? undefined,
				subjectName: input.subjectName,
				overallPercent: input.overallPercent,
				testId: input.testId,
				pdfSignedUrl,
			});
			if (error) {
				failedCount++;
				logServerError("notifications.report_pdf_ready.student_email", new Error(error), {
					studentId: input.studentId,
					testId: input.testId,
				});
			} else {
				sent++;
				// In-app row was written by `notifyTestReportReady` inside the
				// grader; mark it `email_sent=true` so admin tooling and the
				// bell UI know the user got both halves.
				const id = await findNotificationIdForEmailRef({
					recipientId: input.studentId,
					referenceType: "test",
					referenceId: input.testId,
					category: "test_report_ready",
				});
				if (id) await markNotificationEmailSent(id);
			}
		}

		const linkRows = await db
			.select({ parentId: parentStudentLinks.parentId })
			.from(parentStudentLinks)
			.where(and(eq(parentStudentLinks.studentId, input.studentId), eq(parentStudentLinks.status, "active")));

		await Promise.allSettled(
			linkRows.map(async ({ parentId }) => {
				try {
					const parentPrefs = await getNotificationPrefs(parentId);
					if (!isEmailAllowed(parentPrefs, "test_result")) return;

					const parentContact = await loadProfileContact(parentId);
					if (!parentContact?.email) return;

					const parentDisplayName = formatPersonDisplayName(parentContact.fullName ?? "") || null;
					const { error } = await sendParentPortalReportReadyEmail({
						to: parentContact.email,
						recipientUserId: parentId,
						parentDisplayName,
						childDisplayName: childLabel,
						studentId: input.studentId,
						subjectName: input.subjectName,
						overallPercent: input.overallPercent,
						testId: input.testId,
						pdfSignedUrl,
					});
					if (error) {
						failedCount++;
						logServerError("notifications.report_pdf_ready.parent_email", new Error(error), {
							parentId,
							studentId: input.studentId,
							testId: input.testId,
						});
					} else {
						sent++;
						const id = await findNotificationIdForEmailRef({
							recipientId: parentId,
							referenceType: "test",
							referenceId: input.testId,
							category: "test_report_ready",
						});
						if (id) await markNotificationEmailSent(id);
					}
				} catch (err) {
					failedCount++;
					logServerError("notifications.report_pdf_ready.parent", err, {
						parentId,
						studentId: input.studentId,
						testId: input.testId,
					});
				}
			}),
		);
	} catch (err) {
		logServerError("notifications.report_pdf_ready", err, {
			studentId: input.studentId,
			testId: input.testId,
		});
		return {
			ok: false,
			sent,
			failedCount: failedCount + 1,
			permanentlyFailed: false,
			reason: err instanceof Error ? err.message : "unknown",
		};
	}
	if (failedCount === 0) return { ok: true, sent };
	return {
		ok: false,
		sent,
		failedCount,
		permanentlyFailed: false,
		reason: `${failedCount} email send(s) failed`,
	};
}

function buildReportBody(input: NotifyTestReportReadyInput): string {
	const pct =
		input.overallPercent != null && Number.isFinite(input.overallPercent)
			? `You scored ${Math.round(input.overallPercent)}%. `
			: "";
	return `${pct}Tap View report for topic-level strengths, weaknesses, and your next recommended practice.`;
}

function buildParentPortalReportBody(input: NotifyTestReportReadyInput, childLabel: string): string {
	const pct =
		input.overallPercent != null && Number.isFinite(input.overallPercent)
			? `${childLabel} scored ${Math.round(input.overallPercent)}%. `
			: "";
	return `${pct}Open the report for topic strengths, gaps, and suggested next practice.`;
}

/**
 * Loads display contact (email + full_name) for any profile id — student,
 * parent, or teacher. The earlier name `loadStudentContact` was misleading
 * because it was called for parents too; the implementation has always been
 * "join profiles to auth.users by id".
 */
export async function loadProfileContact(profileId: string): Promise<{
	email: string | null;
	fullName: string | null;
} | null> {
	try {
		const rows = await db
			.select({ email: authUsers.email, fullName: profiles.fullName })
			.from(profiles)
			.leftJoin(authUsers, eq(authUsers.id, profiles.id))
			.where(eq(profiles.id, profileId))
			.limit(1);
		const row = rows[0];
		if (!row) return null;
		return { email: row.email ?? null, fullName: row.fullName ?? null };
	} catch (err) {
		logServerError("notifications.load_profile_contact", err, { profileId });
		return null;
	}
}

