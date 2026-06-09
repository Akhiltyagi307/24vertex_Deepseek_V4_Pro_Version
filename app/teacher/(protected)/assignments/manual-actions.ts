"use server";

import { revalidatePath } from "next/cache";

import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { deriveManualConfig } from "@/lib/assignments/manual-helpers";
import {
	createPublishedManualAssignment,
	saveManualAssignmentDraft,
	updatePublishedManualAssignment,
} from "@/lib/assignments/manual-queries";
import {
	createManualAssignmentInputSchema,
	saveManualAssignmentDraftInputSchema,
	updateManualAssignmentInputSchema,
} from "@/lib/assignments/manual-schemas";
import { validatePracticeAssignmentConfigForStudents } from "@/lib/assignments/queries";
import { notifyAssignmentPublished } from "@/lib/notifications/assignment-events";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { logServerError } from "@/lib/server/log-supabase-error";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { teacherFilterAccessibleStudentIdsForSession } from "@/lib/teachers/teacher-student-access";

export type ManualAssignmentActionState = {
	ok: boolean;
	message: string;
	assignmentId?: string;
	title?: string;
	studentCount?: number;
	appliedToNotStarted?: number;
	skippedAlreadyStarted?: number;
};

export async function saveManualAssignmentDraftAction(input: unknown): Promise<ManualAssignmentActionState> {
	return withTeacherActionTelemetry("saveManualAssignmentDraftAction", async (breadcrumb) => {
		const session = await getVerifiedTeacherSession();
		if (!session.ok) return { ok: false, message: session.message };
		const { user } = session;
		const rate = await consumeTeacherPortalDataActionRateLimit(user.id);
		if (!rate.ok) return { ok: false, message: rate.message };

		const parsed = saveManualAssignmentDraftInputSchema.safeParse(input);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the draft." };
		}
		const organization = await getActiveTeacherOrganizationSnapshot(user.id);
		const result = await saveManualAssignmentDraft({
			teacherId: user.id,
			organizationId: organization?.id ?? null,
			assignmentId: parsed.data.assignment_id ?? null,
			title: parsed.data.title,
			instructions: parsed.data.instructions,
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			dueAt: parsed.data.due_at,
			questions: parsed.data.questions,
			studentIds: parsed.data.student_ids,
		});
		revalidatePath("/teacher/assignments");
		return { ok: true, message: "Draft saved.", assignmentId: result.assignmentId };
	});
}

export async function publishManualAssignmentAction(
	input: unknown,
	fromDraftId?: string,
): Promise<ManualAssignmentActionState> {
	return withTeacherActionTelemetry("publishManualAssignmentAction", async (breadcrumb) => {
		const session = await getVerifiedTeacherSession();
		if (!session.ok) return { ok: false, message: session.message };
		const { profile, user } = session;
		const rate = await consumeTeacherPortalDataActionRateLimit(user.id);
		if (!rate.ok) return { ok: false, message: rate.message };

		const parsed = createManualAssignmentInputSchema.safeParse(input);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the assignment." };
		}

		const uniqueStudentIds = [...new Set(parsed.data.student_ids)];
		const accessible = await teacherFilterAccessibleStudentIdsForSession(user.id, uniqueStudentIds);
		if (uniqueStudentIds.some((id) => !accessible.has(id))) {
			breadcrumb("inaccessible_students");
			return { ok: false, message: "One or more selected students are no longer in your roster." };
		}

		const organization = await getActiveTeacherOrganizationSnapshot(user.id);
		const config = deriveManualConfig({
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			questions: parsed.data.questions,
		});
		const scope = await validatePracticeAssignmentConfigForStudents({
			activeOrganizationId: organization?.id ?? null,
			teacherRosterGrade: profile.teacher_roster_grade,
			teacherRosterSubjectId: profile.teacher_roster_subject_id,
			config: { subject_id: config.subject_id, topic_ids: config.topic_ids },
			studentIds: uniqueStudentIds,
		});
		if (!scope.ok) {
			breadcrumb("scope_failed");
			return { ok: false, message: scope.message };
		}

		const result = await createPublishedManualAssignment({
			teacherId: user.id,
			organizationId: organization?.id ?? null,
			fromDraftId: fromDraftId ?? null,
			title: parsed.data.title,
			instructions: parsed.data.instructions,
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			dueAt: parsed.data.due_at,
			questions: parsed.data.questions,
			studentIds: uniqueStudentIds,
		});

		await notifyAssignmentPublished({
			teacherId: user.id,
			assignmentId: result.assignmentId,
			title: parsed.data.title,
			studentIds: uniqueStudentIds,
		});
		void triggerPracticeWorkerInBackground().catch((error) => {
			logServerError("publishManualAssignmentAction.triggerWorker", error, { assignmentId: result.assignmentId });
		});

		breadcrumb("assignment_published", {
			assignmentId: result.assignmentId,
			studentCount: uniqueStudentIds.length,
		});
		revalidatePath("/teacher/assignments");
		revalidatePath("/teacher/submissions");
		return {
			ok: true,
			message: `Assignment published for ${uniqueStudentIds.length} student${uniqueStudentIds.length === 1 ? "" : "s"}.`,
			assignmentId: result.assignmentId,
			title: parsed.data.title,
			studentCount: uniqueStudentIds.length,
		};
	});
}

export async function updatePublishedManualAssignmentAction(input: unknown): Promise<ManualAssignmentActionState> {
	return withTeacherActionTelemetry("updatePublishedManualAssignmentAction", async (breadcrumb) => {
		const session = await getVerifiedTeacherSession();
		if (!session.ok) return { ok: false, message: session.message };
		const { profile, user } = session;
		const rate = await consumeTeacherPortalDataActionRateLimit(user.id);
		if (!rate.ok) return { ok: false, message: rate.message };

		const parsed = updateManualAssignmentInputSchema.safeParse(input);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your edits." };
		}

		const organization = await getActiveTeacherOrganizationSnapshot(user.id);
		const config = deriveManualConfig({
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			questions: parsed.data.questions,
		});
		const scope = await validatePracticeAssignmentConfigForStudents({
			activeOrganizationId: organization?.id ?? null,
			teacherRosterGrade: profile.teacher_roster_grade,
			teacherRosterSubjectId: profile.teacher_roster_subject_id,
			config: { subject_id: config.subject_id, topic_ids: config.topic_ids },
			studentIds: [],
		});
		if (!scope.ok) {
			breadcrumb("scope_failed");
			return { ok: false, message: scope.message };
		}
		const result = await updatePublishedManualAssignment({
			teacherId: user.id,
			organizationId: organization?.id ?? null,
			assignmentId: parsed.data.assignment_id,
			title: parsed.data.title,
			instructions: parsed.data.instructions,
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			dueAt: parsed.data.due_at,
			questions: parsed.data.questions,
		});
		void triggerPracticeWorkerInBackground().catch((error) => {
			logServerError("updatePublishedManualAssignmentAction.triggerWorker", error, {
				assignmentId: parsed.data.assignment_id,
			});
		});

		breadcrumb("assignment_updated", {
			assignmentId: parsed.data.assignment_id,
			appliedToNotStarted: result.appliedToNotStarted,
		});
		revalidatePath("/teacher/assignments");
		revalidatePath("/teacher/submissions");
		return {
			ok: true,
			message: `Updated. ${result.appliedToNotStarted} not-yet-started student(s) will get the new questions; ${result.skippedAlreadyStarted} already started and were not changed.`,
			assignmentId: parsed.data.assignment_id,
			appliedToNotStarted: result.appliedToNotStarted,
			skippedAlreadyStarted: result.skippedAlreadyStarted,
		};
	});
}
