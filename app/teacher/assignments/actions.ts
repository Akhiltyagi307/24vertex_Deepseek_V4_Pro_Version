"use server";

import { revalidatePath } from "next/cache";

import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import {
	createPublishedPracticeAssignment,
	validatePracticeAssignmentConfigForStudents,
} from "@/lib/assignments/queries";
import { createAssignmentInputSchema } from "@/lib/assignments/schemas";
import { notifyAssignmentPublished } from "@/lib/notifications/assignment-events";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { logServerError } from "@/lib/server/log-supabase-error";
import { teacherCanAccessStudentForSession } from "@/lib/teachers/teacher-student-access";

export type CreateTeacherAssignmentState = {
	ok: boolean;
	message: string;
};

function formValueArray(formData: FormData, name: string): string[] {
	return formData
		.getAll(name)
		.map((value) => (typeof value === "string" ? value.trim() : ""))
		.filter(Boolean);
}

export async function createTeacherAssignmentAction(
	_prevState: CreateTeacherAssignmentState,
	formData: FormData,
): Promise<CreateTeacherAssignmentState> {
	const user = await getServerUser();
	const profile = await getCachedAppProfileRow();
	if (!user || !profile || profile.role !== "teacher") {
		return { ok: false, message: "Sign in as a teacher to create assignments." };
	}
	if (!profile.is_verified) {
		return { ok: false, message: "Your teacher account must be verified before assigning tests." };
	}

	const subjectId = String(formData.get("subject_id") ?? "").trim();
	const durationSeconds = Number(formData.get("time_limit_seconds") ?? 3600);
	const questionCount = durationSeconds === 10800 ? 30 : 15;
	const parsed = createAssignmentInputSchema.safeParse({
		title: formData.get("title"),
		instructions: formData.get("instructions"),
		due_at: formData.get("due_at"),
		config: {
			v: 1,
			kind: "practice_test",
			subject_id: subjectId,
			topic_ids: formValueArray(formData, "topic_ids"),
			difficulty: formData.get("difficulty"),
			question_count: questionCount,
			time_limit_seconds: durationSeconds,
		},
		student_ids: formValueArray(formData, "student_ids"),
	});

	if (!parsed.success) {
		return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the assignment form." };
	}

	const uniqueStudentIds = [...new Set(parsed.data.student_ids)];
	const accessChecks = await Promise.all(
		uniqueStudentIds.map(async (studentId) => ({
			studentId,
			allowed: await teacherCanAccessStudentForSession(user.id, studentId),
		})),
	);
	const denied = accessChecks.find((check) => !check.allowed);
	if (denied) {
		return { ok: false, message: "One or more selected students are no longer in your roster." };
	}

	const activeOrganization = await getActiveTeacherOrganizationSnapshot(user.id);
	const scopeCheck = await validatePracticeAssignmentConfigForStudents({
		activeOrganizationId: activeOrganization?.id ?? null,
		teacherRosterGrade: profile.teacher_roster_grade,
		teacherRosterSubjectId: profile.teacher_roster_subject_id,
		config: parsed.data.config,
		studentIds: uniqueStudentIds,
	});
	if (!scopeCheck.ok) {
		return { ok: false, message: scopeCheck.message };
	}

	const result = await createPublishedPracticeAssignment({
		teacherId: user.id,
		organizationId: activeOrganization?.id ?? null,
		title: parsed.data.title,
		instructions: parsed.data.instructions,
		config: parsed.data.config,
		studentIds: uniqueStudentIds,
		dueAt: parsed.data.due_at,
	});

	await notifyAssignmentPublished({
		teacherId: user.id,
		assignmentId: result.assignmentId,
		title: parsed.data.title,
		studentIds: uniqueStudentIds,
	});

	void triggerPracticeWorkerInBackground().catch((error) => {
		logServerError("createTeacherAssignmentAction.triggerPracticeWorkerInBackground", error, {
			assignmentId: result.assignmentId,
		});
	});

	revalidatePath("/teacher/assignments");
	return {
		ok: true,
		message: `Assignment published for ${uniqueStudentIds.length} student${uniqueStudentIds.length === 1 ? "" : "s"}.`,
	};
}
