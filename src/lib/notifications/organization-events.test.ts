import { describe, expect, it, vi, beforeEach } from "vitest";

import {
	notifyStudentOrganizationChanged,
	notifyTeacherLinkedStudent,
} from "@/lib/notifications/organization-events";
import { insertInAppNotification, markNotificationEmailSent } from "@/lib/notifications/insert";
import { sendOrganizationEventEmail } from "@/lib/email/organization-emails";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/notifications/report-ready", () => ({
	loadProfileContact: vi.fn(async (profileId: string) => {
		const contacts: Record<string, { email: string | null; fullName: string | null }> = {
			student1: { email: "student@example.com", fullName: "Stu Dent" },
			teacher1: { email: "teacher@example.com", fullName: "Tina Teacher" },
		};
		return contacts[profileId] ?? { email: null, fullName: null };
	}),
}));

vi.mock("@/lib/notifications/prefs", () => ({
	getNotificationPrefs: vi.fn(async () => ({
		enableInApp: true,
		enableEmail: true,
		types: { system: true },
	})),
	isEmailAllowed: vi.fn(() => true),
}));

vi.mock("@/lib/notifications/insert", () => ({
	insertInAppNotification: vi.fn(async () => "notification-id"),
	markNotificationEmailSent: vi.fn(async () => {}),
}));

vi.mock("@/lib/email/organization-emails", () => ({
	sendOrganizationEventEmail: vi.fn(async () => ({ error: null })),
}));

describe("organization event notifications", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("notifies a student in-app and by email when they connect to an organization", async () => {
		await notifyStudentOrganizationChanged({
			studentId: "student1",
			organizationId: "org1",
			organizationName: "Delhi Public School",
			action: "linked",
		});

		expect(insertInAppNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientId: "student1",
				title: "Connected to Delhi Public School",
				category: "student_organization_linked",
				referenceType: "organization",
				referenceId: "org1",
				forceInApp: true,
			}),
		);
		expect(sendOrganizationEventEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "student@example.com",
				recipientUserId: "student1",
				event: "student_organization_linked",
				organizationName: "Delhi Public School",
			}),
		);
		expect(markNotificationEmailSent).toHaveBeenCalledWith("notification-id");
	});

	it("notifies both student and teacher when an independent teacher links a student", async () => {
		await notifyTeacherLinkedStudent({
			studentId: "student1",
			teacherId: "teacher1",
		});

		expect(insertInAppNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientId: "student1",
				senderId: "teacher1",
				title: "Teacher linked to your account",
				category: "teacher_linked_student",
				referenceType: "profile",
				referenceId: "teacher1",
				forceInApp: true,
			}),
		);
		expect(insertInAppNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientId: "teacher1",
				senderId: "student1",
				title: "Student linked",
				category: "teacher_student_link_confirmed",
				referenceType: "student",
				referenceId: "student1",
				forceInApp: true,
			}),
		);
		expect(sendOrganizationEventEmail).toHaveBeenCalledTimes(2);
	});
});
