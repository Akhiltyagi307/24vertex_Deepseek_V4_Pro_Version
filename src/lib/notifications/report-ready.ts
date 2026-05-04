import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { sendParentPortalReportReadyEmail, sendReportReadyEmail } from "@/lib/email/notifications-emails";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { insertInAppNotification } from "@/lib/notifications/insert";
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
 * Emits the "your report is ready" in-app notification after grading finishes.
 * Report-ready emails (student + linked parents) are sent from the PDF pipeline
 * with a Supabase signed URL so recipients can open the PDF without EduAI login.
 */
export async function notifyTestReportReady(input: NotifyTestReportReadyInput): Promise<void> {
	try {
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

		await notifyLinkedParentsTestReportReadyInApp(input);
	} catch (err) {
		logServerError("notifications.report_ready", err, {
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

	const contact = await loadStudentContact(input.studentId);
	const childLabel = formatPersonDisplayName(contact?.fullName ?? "") || "your child";

	for (const { parentId } of linkRows) {
		try {
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
	}
}

export type NotifyTestReportPdfReadyEmailsInput = {
	testId: string;
	studentId: string;
	subjectName: string;
	overallPercent: number | null;
	storagePath: string;
};

/**
 * Sends student + parent "report ready" emails after the PDF is in Storage.
 * Uses a time-limited signed URL so the PDF opens without EduAI authentication.
 */
export async function notifyTestReportPdfReadyEmails(input: NotifyTestReportPdfReadyEmailsInput): Promise<void> {
	try {
		const signed = await createStudentTestReportPdfSignedUrl(input.storagePath);
		if (!signed.ok) {
			logServerError("notifications.report_pdf_ready.signed_url", new Error(signed.message), {
				testId: input.testId,
				studentId: input.studentId,
			});
			return;
		}
		const pdfSignedUrl = signed.url;

		const prefs = await getNotificationPrefs(input.studentId);
		if (isEmailAllowed(prefs, "test_result")) {
			const contact = await loadStudentContact(input.studentId);
			if (contact?.email) {
				const { error } = await sendReportReadyEmail({
					to: contact.email,
					recipientUserId: input.studentId,
					studentName: contact.fullName ?? undefined,
					subjectName: input.subjectName,
					overallPercent: input.overallPercent,
					testId: input.testId,
					pdfSignedUrl,
				});
				if (error) {
					logServerError("notifications.report_pdf_ready.student_email", new Error(error), {
						studentId: input.studentId,
						testId: input.testId,
					});
				}
			}
		}

		const linkRows = await db
			.select({ parentId: parentStudentLinks.parentId })
			.from(parentStudentLinks)
			.where(and(eq(parentStudentLinks.studentId, input.studentId), eq(parentStudentLinks.status, "active")));

		const studentContact = await loadStudentContact(input.studentId);
		const childLabel = formatPersonDisplayName(studentContact?.fullName ?? "") || "your child";

		for (const { parentId } of linkRows) {
			try {
				const parentPrefs = await getNotificationPrefs(parentId);
				if (!isEmailAllowed(parentPrefs, "test_result")) continue;

				const parentContact = await loadStudentContact(parentId);
				if (!parentContact?.email) continue;

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
					logServerError("notifications.report_pdf_ready.parent_email", new Error(error), {
						parentId,
						studentId: input.studentId,
						testId: input.testId,
					});
				}
			} catch (err) {
				logServerError("notifications.report_pdf_ready.parent", err, {
					parentId,
					studentId: input.studentId,
					testId: input.testId,
				});
			}
		}
	} catch (err) {
		logServerError("notifications.report_pdf_ready", err, {
			studentId: input.studentId,
			testId: input.testId,
		});
	}
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

export async function loadStudentContact(studentId: string): Promise<{
	email: string | null;
	fullName: string | null;
} | null> {
	try {
		const rows = await db
			.select({ email: authUsers.email, fullName: profiles.fullName })
			.from(profiles)
			.leftJoin(authUsers, eq(authUsers.id, profiles.id))
			.where(eq(profiles.id, studentId))
			.limit(1);
		const row = rows[0];
		if (!row) return null;
		return { email: row.email ?? null, fullName: row.fullName ?? null };
	} catch (err) {
		logServerError("notifications.load_student_contact", err, { studentId });
		return null;
	}
}
