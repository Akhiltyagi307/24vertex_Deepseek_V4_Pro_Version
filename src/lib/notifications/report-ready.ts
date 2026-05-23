import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { sendParentPortalReportReadyEmail, sendReportReadyEmail } from "@/lib/email/notifications-emails";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import {
	findNotificationIdForEmailRef,
	insertInAppNotification,
	markNotificationEmailSent,
	MAX_NOTIFICATION_TITLE_LEN,
} from "@/lib/notifications/insert";
import { getNotificationPrefs, isEmailAllowed } from "@/lib/notifications/prefs";
import { logServerError } from "@/lib/server/log-supabase-error";
import { formatPracticeReportSubmittedLabel } from "@/lib/notifications/report-datetime-label";
import { resolvePracticeReportEmailFacts } from "@/lib/notifications/practice-report-email-facts";
import { createStudentTestReportPdfSignedUrl } from "@/lib/practice/student-test-report-pdf-signed-url";

export { formatPracticeReportSubmittedLabel } from "@/lib/notifications/report-datetime-label";

export type NotifyTestReportReadyInput = {
	studentId: string;
	testId: string;
	subjectName: string;
	overallPercent: number | null;
	/** `tests.test_date` (submit time). Makes duplicate subject titles distinguishable in the bell. */
	submittedAtIso?: string | null;
};

function trimTitle(raw: string): string {
	return raw.length <= MAX_NOTIFICATION_TITLE_LEN ?
			raw
		:	`${raw.slice(0, Math.max(0, MAX_NOTIFICATION_TITLE_LEN - 1))}…`;
}

function studentReportReadyTitle(input: NotifyTestReportReadyInput): string {
	const label = formatPracticeReportSubmittedLabel(input.submittedAtIso);
	const base = `Your ${input.subjectName} report is ready`;
	const withWhen = label ? `${base} (${label})` : base;
	return trimTitle(withWhen);
}

function parentReportReadyTitle(childLabel: string, input: NotifyTestReportReadyInput): string {
	const label = formatPracticeReportSubmittedLabel(input.submittedAtIso);
	const base = `${childLabel}: ${input.subjectName} report ready`;
	const withWhen = label ? `${base} (${label})` : base;
	return trimTitle(withWhen);
}

/**
 * Emits the "your report is ready" in-app notification as soon as grading
 * persists (`gradePracticeTestWithAi`). The PDF/email pipeline calls this again
 * after upload for idempotent no-ops under the partial unique index — students
 * see the bell immediately instead of waiting behind a backed-up PDF queue.
 *
 * Idempotency contract — both halves below write `notifications` rows keyed by
 * `(recipient_id, reference_type=test, reference_id, category=test_report_ready)`.
 * A partial unique index enforces this at the DB layer, so retries or
 * overlapping workers naturally collapse to one card per recipient × test.
 *
 *  - Student emit: insert (or no-op on unique conflict).
 *  - Parent emit:  per-parent insert (or no-op on unique conflict).
 *
 * The two halves are independent on purpose: a parent emit failure must NOT
 * cause the student emit to retry (and vice versa). On any retry, both halves
 * remain idempotent — which is correct behavior, not desync. Do not "unify"
 * by sharing a single
 * dedup row across roles; the bell UI keys by recipient.
 *
 * Report-ready emails (student + linked parents) are sent from the email job
 * (`handleEmailJob` in `app/api/internal/practice/run-jobs/route.ts`) with a
 * Supabase signed URL so recipients can open the PDF without 24Vertex login.
 */
export async function notifyTestReportReady(input: NotifyTestReportReadyInput): Promise<void> {
	try {
		const prefs = await getNotificationPrefs(input.studentId);
		await insertInAppNotification({
			recipientId: input.studentId,
			title: studentReportReadyTitle(input),
			body: buildReportBody(input),
			type: "test_result",
			category: "test_report_ready",
			referenceType: "test",
			referenceId: input.testId,
			prefs,
		});
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
				const prefs = await getNotificationPrefs(parentId);
				await insertInAppNotification({
					recipientId: parentId,
					title: parentReportReadyTitle(childLabel, input),
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
	/** Queue hint only — email body/PDF use DB-resolved subject after grading. */
	subjectName: string;
	overallPercent: number | null;
	/** Queue hint only — signing uses canonical `{studentId}/{testId}.pdf` unless DB path validates. */
	storagePath?: string | null;
};

/**
 * Aggregated email-send result. `permanentlyFailed` is set when the
 * underlying issue cannot be retried (e.g., unknown test / owner mismatch)
 * so the caller can mark the queue job dead immediately instead of retrying
 * indefinitely.
 */
export type NotifyTestReportPdfReadyEmailsResult =
	| { ok: true; sent: number }
	| { ok: false; sent: number; failedCount: number; permanentlyFailed: boolean; reason: string };

/**
 * Sends student + parent "report ready" emails after the PDF is in Storage.
 * Uses a time-limited signed URL so the PDF opens without 24Vertex authentication.
 *
 * Subject line, score, PDF storage path, and submission label are **resolved
 * from Postgres at send time** (`tests`, `subjects`, `test_reports`) so queued
 * job payloads cannot drift from the interactive report (stale subject names
 * from delayed email jobs were misleading users).
 *
 * Idempotency: `sendHtmlEmailLogged` is called with a `dedupKey` per recipient
 * (`report-ready:${testId}:${student|parent}:${recipientId}`) so concurrent
 * grading retries do not produce duplicate sends.
 */
export async function notifyTestReportPdfReadyEmails(
	input: NotifyTestReportPdfReadyEmailsInput,
): Promise<NotifyTestReportPdfReadyEmailsResult> {
	let sent = 0;
	let failedCount = 0;
	try {
		const resolved = await resolvePracticeReportEmailFacts({
			testId: input.testId,
			studentId: input.studentId,
			payloadSubjectName: input.subjectName,
			payloadStoragePath: input.storagePath ?? null,
		});

		if (!resolved.ok) {
			const permanent =
				resolved.reason === "test_not_found" || resolved.reason === "student_test_mismatch";
			return {
				ok: false,
				sent: 0,
				failedCount: 0,
				permanentlyFailed: permanent,
				reason: resolved.reason,
			};
		}

		const signed = await createStudentTestReportPdfSignedUrl(resolved.storagePath);
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

		const submittedLabel = formatPracticeReportSubmittedLabel(resolved.submittedAtIso);

		const studentContact = await loadProfileContact(input.studentId);
		const childLabel = formatPersonDisplayName(studentContact?.fullName ?? "") || "your child";

		const studentPrefs = await getNotificationPrefs(input.studentId);
		if (isEmailAllowed(studentPrefs, "test_result") && studentContact?.email) {
			const { error } = await sendReportReadyEmail({
				to: studentContact.email,
				recipientUserId: input.studentId,
				studentName: studentContact.fullName ?? undefined,
				subjectName: resolved.subjectName,
				overallPercent: resolved.overallPercent,
				testId: input.testId,
				pdfSignedUrl,
				submittedLabel,
			});
			if (error) {
				failedCount++;
				logServerError("notifications.report_pdf_ready.student_email", new Error(error), {
					studentId: input.studentId,
					testId: input.testId,
				});
			} else {
				sent++;
				// In-app row was written by `notifyTestReportReady` during grading (and
				// optionally replayed after PDF); mark `email_sent=true` so admin tooling
				// and the bell UI know the user got both halves.
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
						subjectName: resolved.subjectName,
						overallPercent: resolved.overallPercent,
						testId: input.testId,
						pdfSignedUrl,
						submittedLabel,
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
	return `${pct}Tap View report for topic breakdowns and next practice. A printable PDF follows by email when rendering finishes.`;
}

function buildParentPortalReportBody(input: NotifyTestReportReadyInput, childLabel: string): string {
	const pct =
		input.overallPercent != null && Number.isFinite(input.overallPercent)
			? `${childLabel} scored ${Math.round(input.overallPercent)}%. `
			: "";
	return `${pct}Open the report for topic strengths, gaps, and suggested next practice. A printable PDF email may arrive shortly.`;
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

