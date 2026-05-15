import "server-only";

import {
	sendOrganizationEventEmail,
	type OrganizationEmailEvent,
} from "@/lib/email/organization-emails";
import {
	insertInAppNotification,
	markNotificationEmailSent,
	type InsertInAppInput,
} from "@/lib/notifications/insert";
import { getNotificationPrefs, isEmailAllowed } from "@/lib/notifications/prefs";
import { loadProfileContact } from "@/lib/notifications/report-ready";
import { logServerError } from "@/lib/server/log-supabase-error";

type StudentOrganizationAction = "linked" | "unlinked" | "deactivated";
type TeacherOrganizationAction = "joined" | "left" | "deactivated";

type OrganizationNotificationBase = {
	organizationId: string;
	organizationName: string;
};

export type NotifyStudentOrganizationChangedInput = OrganizationNotificationBase & {
	studentId: string;
	action: StudentOrganizationAction;
};

export type NotifyTeacherOrganizationChangedInput = OrganizationNotificationBase & {
	teacherId: string;
	action: TeacherOrganizationAction;
	revokedLinksCount?: number;
};

export type NotifyTeacherLinkedStudentInput = {
	teacherId: string;
	studentId: string;
};

async function sendPairedNotification(input: {
	recipientId: string;
	emailEvent: OrganizationEmailEvent;
	inApp: InsertInAppInput;
	email: Omit<
		Parameters<typeof sendOrganizationEventEmail>[0],
		"to" | "recipientUserId" | "event" | "displayName"
	>;
}) {
	const prefs = await getNotificationPrefs(input.recipientId);
	const contact = await loadProfileContact(input.recipientId);

	let notificationId: string | null = null;
	try {
		notificationId = await insertInAppNotification({
			...input.inApp,
			prefs,
			forceInApp: true,
		});
	} catch (err) {
		logServerError("sendPairedNotification.insertInAppNotification", err, {
			recipientId: input.recipientId,
			category: input.inApp.category,
		});
		// In-app notification failure must not block the email.
	}

	if (!contact?.email || !isEmailAllowed(prefs, "system")) return;

	const result = await sendOrganizationEventEmail({
		...input.email,
		to: contact.email,
		recipientUserId: input.recipientId,
		displayName: contact.fullName,
		event: input.emailEvent,
	});

	if (!result.error && notificationId) {
		await markNotificationEmailSent(notificationId);
	}
}

export async function notifyStudentOrganizationChanged(
	input: NotifyStudentOrganizationChangedInput,
): Promise<void> {
	const eventByAction: Record<StudentOrganizationAction, OrganizationEmailEvent> = {
		linked: "student_organization_linked",
		unlinked: "student_organization_unlinked",
		deactivated: "student_organization_deactivated",
	};
	const titleByAction: Record<StudentOrganizationAction, string> = {
		linked: `Connected to ${input.organizationName}`,
		unlinked: `Disconnected from ${input.organizationName}`,
		deactivated: `${input.organizationName} was removed`,
	};
	const bodyByAction: Record<StudentOrganizationAction, string> = {
		linked: `Your student account is now connected to ${input.organizationName}.`,
		unlinked: `Your student account is no longer connected to ${input.organizationName}. Independent teacher links are unchanged.`,
		deactivated: `${input.organizationName} is no longer active, so your student account was disconnected from it.`,
	};

	try {
		await sendPairedNotification({
			recipientId: input.studentId,
			emailEvent: eventByAction[input.action],
			inApp: {
				recipientId: input.studentId,
				title: titleByAction[input.action],
				body: bodyByAction[input.action],
				type: "system",
				category: eventByAction[input.action],
				referenceType: "organization",
				referenceId: input.organizationId,
				forceInApp: true,
			},
			email: {
				organizationName: input.organizationName,
				dedupKey: `${eventByAction[input.action]}:${input.studentId}:${input.organizationId}`,
			},
		});
	} catch (err) {
		logServerError("notifications.organization.student", err, {
			studentId: input.studentId,
			organizationId: input.organizationId,
			action: input.action,
		});
	}
}

export async function notifyTeacherOrganizationChanged(
	input: NotifyTeacherOrganizationChangedInput,
): Promise<void> {
	const eventByAction: Record<TeacherOrganizationAction, OrganizationEmailEvent> = {
		joined: "teacher_organization_joined",
		left: "teacher_organization_left",
		deactivated: "teacher_organization_deactivated",
	};
	const revoked =
		input.revokedLinksCount && input.revokedLinksCount > 0
			? ` ${input.revokedLinksCount} independent student link${input.revokedLinksCount === 1 ? " was" : "s were"} revoked.`
			: "";
	const titleByAction: Record<TeacherOrganizationAction, string> = {
		joined: `Connected to ${input.organizationName}`,
		left: `Disconnected from ${input.organizationName}`,
		deactivated: `${input.organizationName} was removed`,
	};
	const bodyByAction: Record<TeacherOrganizationAction, string> = {
		joined: `Your teacher account is now connected to ${input.organizationName}.${revoked}`,
		left: `Your teacher account is no longer connected to ${input.organizationName}.`,
		deactivated: `${input.organizationName} is no longer active, so your teacher account was disconnected from it.`,
	};

	try {
		await sendPairedNotification({
			recipientId: input.teacherId,
			emailEvent: eventByAction[input.action],
			inApp: {
				recipientId: input.teacherId,
				title: titleByAction[input.action],
				body: bodyByAction[input.action],
				type: "system",
				category: eventByAction[input.action],
				referenceType: "organization",
				referenceId: input.organizationId,
				forceInApp: true,
			},
			email: {
				organizationName: input.organizationName,
				revokedLinksCount: input.revokedLinksCount ?? 0,
				dedupKey: `${eventByAction[input.action]}:${input.teacherId}:${input.organizationId}`,
			},
		});
	} catch (err) {
		logServerError("notifications.organization.teacher", err, {
			teacherId: input.teacherId,
			organizationId: input.organizationId,
			action: input.action,
		});
	}
}

export async function notifyTeacherLinkedStudent(input: NotifyTeacherLinkedStudentInput): Promise<void> {
	try {
		const [teacherContact, studentContact] = await Promise.all([
			loadProfileContact(input.teacherId),
			loadProfileContact(input.studentId),
		]);

		const teacherName = teacherContact?.fullName ?? "A teacher";
		const studentName = studentContact?.fullName ?? "your student";

		await Promise.all([
			sendPairedNotification({
				recipientId: input.studentId,
				emailEvent: "teacher_linked_student",
				inApp: {
					recipientId: input.studentId,
					senderId: input.teacherId,
					title: "Teacher linked to your account",
					body: `${teacherName} linked to your student account using your link code.`,
					type: "system",
					category: "teacher_linked_student",
					referenceType: "profile",
					referenceId: input.teacherId,
					forceInApp: true,
				},
				email: {
					teacherName,
					dedupKey: `teacher_linked_student:${input.teacherId}:${input.studentId}`,
				},
			}),
			sendPairedNotification({
				recipientId: input.teacherId,
				emailEvent: "teacher_student_link_confirmed",
				inApp: {
					recipientId: input.teacherId,
					senderId: input.studentId,
					title: "Student linked",
					body: `You are now linked to ${studentName} as an independent teacher.`,
					type: "system",
					category: "teacher_student_link_confirmed",
					referenceType: "student",
					referenceId: input.studentId,
					contextStudentId: input.studentId,
					forceInApp: true,
				},
				email: {
					studentName,
					dedupKey: `teacher_student_link_confirmed:${input.teacherId}:${input.studentId}`,
				},
			}),
		]);
	} catch (err) {
		logServerError("notifications.organization.teacher_student_link", err, input);
	}
}
