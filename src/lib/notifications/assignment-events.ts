import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { insertInAppNotification } from "@/lib/notifications/insert";
import { getNotificationPrefs } from "@/lib/notifications/prefs";
import { logServerError } from "@/lib/server/log-supabase-error";

async function linkedParents(studentId: string) {
	return db
		.select({
			parentId: parentStudentLinks.parentId,
			childName: profiles.fullName,
		})
		.from(parentStudentLinks)
		.innerJoin(profiles, eq(profiles.id, parentStudentLinks.studentId))
		.where(and(eq(parentStudentLinks.studentId, studentId), eq(parentStudentLinks.status, "active")));
}

export async function notifyAssignmentPublished(input: {
	teacherId: string;
	assignmentId: string;
	title: string;
	studentIds: string[];
}): Promise<void> {
	await Promise.allSettled(
		input.studentIds.map(async (studentId) => {
			try {
				const prefs = await getNotificationPrefs(studentId);
				await insertInAppNotification({
					recipientId: studentId,
					senderId: input.teacherId,
					title: "New practice assignment",
					body: input.title,
					type: "reminder",
					category: "assignment_published",
					referenceType: "assignment",
					referenceId: input.assignmentId,
					prefs,
				});
				const parents = await linkedParents(studentId);
				await Promise.allSettled(
					parents.map(async (parent) => {
						const childLabel = formatPersonDisplayName(parent.childName ?? "") || "Your child";
						const parentPrefs = await getNotificationPrefs(parent.parentId);
						await insertInAppNotification({
							recipientId: parent.parentId,
							senderId: input.teacherId,
							title: `${childLabel} has a new assignment`,
							body: input.title,
							type: "reminder",
							category: "assignment_published",
							referenceType: "assignment",
							referenceId: input.assignmentId,
							contextStudentId: studentId,
							prefs: parentPrefs,
						});
					}),
				);
			} catch (err) {
				logServerError("notifyAssignmentPublished", err, {
					assignmentId: input.assignmentId,
					studentId,
				});
			}
		}),
	);
}

export async function notifyAssignmentMaterialized(input: {
	assignmentId: string;
	submissionId: string;
	studentId: string;
	title: string;
}): Promise<void> {
	try {
		const prefs = await getNotificationPrefs(input.studentId);
		await insertInAppNotification({
			recipientId: input.studentId,
			title: "Assignment ready to take",
			body: input.title,
			type: "reminder",
			category: "assignment_materialized",
			referenceType: "assignment_submission",
			referenceId: input.submissionId,
			prefs,
		});
	} catch (err) {
		logServerError("notifyAssignmentMaterialized", err, input);
	}
}

export async function notifyAssignmentGraded(input: {
	assignmentId: string;
	submissionId: string;
	studentId: string;
	title: string;
	score: string | null;
}): Promise<void> {
	try {
		const body = input.score ? `${input.title} was graded: ${Number(input.score).toFixed(1)}%.` : `${input.title} was graded.`;
		const prefs = await getNotificationPrefs(input.studentId);
		await insertInAppNotification({
			recipientId: input.studentId,
			title: "Assignment graded",
			body,
			type: "test_result",
			category: "assignment_graded",
			referenceType: "assignment_submission",
			referenceId: input.submissionId,
			prefs,
		});
		const parents = await linkedParents(input.studentId);
		await Promise.allSettled(
			parents.map(async (parent) => {
				const childLabel = formatPersonDisplayName(parent.childName ?? "") || "Your child";
				const parentPrefs = await getNotificationPrefs(parent.parentId);
				await insertInAppNotification({
					recipientId: parent.parentId,
					title: `${childLabel}'s assignment was graded`,
					body,
					type: "test_result",
					category: "assignment_graded",
					referenceType: "assignment_submission",
					referenceId: input.submissionId,
					contextStudentId: input.studentId,
					prefs: parentPrefs,
				});
			}),
		);
	} catch (err) {
		logServerError("notifyAssignmentGraded", err, input);
	}
}
