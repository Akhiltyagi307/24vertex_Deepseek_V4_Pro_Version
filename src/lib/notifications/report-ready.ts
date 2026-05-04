import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { sendParentPortalReportReadyEmail, sendReportReadyEmail } from "@/lib/email/notifications-emails";
import { insertInAppNotification } from "@/lib/notifications/insert";
import { getNotificationPrefs, isEmailAllowed } from "@/lib/notifications/prefs";
import { logServerError } from "@/lib/server/log-supabase-error";

export type NotifyTestReportReadyInput = {
	studentId: string;
	testId: string;
	subjectName: string;
	overallPercent: number | null;
};

/**
 * Emits the "your report is ready" notification after grading finishes.
 * Fire-and-forget: all failures are logged and swallowed so grading callers
 * never see an error from this path.
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
				});
				if (error) {
					logServerError("notifications.report_ready.email", new Error(error), {
						studentId: input.studentId,
						testId: input.testId,
					});
				}
			}
		}

		await notifyLinkedParentsTestReportReady(input);
	} catch (err) {
		logServerError("notifications.report_ready", err, {
			studentId: input.studentId,
			testId: input.testId,
		});
	}
}

async function notifyLinkedParentsTestReportReady(input: NotifyTestReportReadyInput): Promise<void> {
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

			if (!isEmailAllowed(prefs, "test_result")) continue;

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
			});
			if (error) {
				logServerError("notifications.report_ready.parent_email", new Error(error), {
					parentId,
					studentId: input.studentId,
					testId: input.testId,
				});
			}
		} catch (err) {
			logServerError("notifications.report_ready.parent", err, {
				parentId,
				studentId: input.studentId,
				testId: input.testId,
			});
		}
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
