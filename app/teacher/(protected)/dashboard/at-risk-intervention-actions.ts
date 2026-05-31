"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import {
	createPublishedPracticeAssignment,
	validatePracticeAssignmentConfigForStudents,
} from "@/lib/assignments/queries";
import { assignmentConfigSchema } from "@/lib/assignments/schemas";
import { notifyAssignmentPublished } from "@/lib/notifications/assignment-events";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { practiceDifficultySchema } from "@/lib/practice";
import { logServerError } from "@/lib/server/log-supabase-error";
import { classifyTeacherActionError } from "@/lib/teachers/classify-teacher-action-error";
import {
	generateAtRiskInterventionPlan,
	type AtRiskInterventionPlan,
} from "@/lib/teachers/teacher-at-risk-intervention";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { teacherFilterAccessibleStudentIdsForSession } from "@/lib/teachers/teacher-student-access";
import { getStudentInterventionTarget } from "@/lib/teachers/teacher-student-weak-topics-queries";

export type PlanAtRiskInterventionResult =
	| { plan: AtRiskInterventionPlan; studentName: string }
	| { error: string };

export type PublishAtRiskInterventionResult =
	| { ok: true; assignmentId: string }
	| { ok: false; message: string };

const planInputSchema = z
	.object({
		studentId: z.string().uuid(),
		subjectId: z.union([z.literal("all"), z.string().uuid()]),
		studentName: z.string().max(120).optional(),
		riskSummary: z.string().max(200).optional(),
	})
	.strict();

const publishInputSchema = z
	.object({
		studentId: z.string().uuid(),
		subjectId: z.string().uuid(),
		topicIds: z.array(z.string().uuid()).min(1).max(20),
		title: z.string().trim().min(1).max(300),
		difficulty: practiceDifficultySchema,
		dueAt: z.string().nullish(),
	})
	.strict();

/**
 * Generate (but do not publish) a remedial plan for one at-risk student: an AI
 * diagnosis plus a suggested title, difficulty, and focus topics drawn from the
 * student's below-target topics. Access is enforced inside
 * `getStudentInterventionTarget`. `studentName`/`riskSummary` are cosmetic prompt
 * context only — publishing re-validates everything server-side.
 */
export async function planAtRiskInterventionAction(
	raw: unknown,
): Promise<PlanAtRiskInterventionResult> {
	return withTeacherActionTelemetry("planAtRiskInterventionAction", async (breadcrumb) => {
		const parsed = planInputSchema.safeParse(raw);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { error: "Invalid request." };
		}

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
		if (!rate.ok) {
			breadcrumb("rate_limited");
			return { error: rate.message };
		}

		const activeOrg = await getActiveTeacherOrganizationSnapshot(session.user.id);
		const forcedRosterSubjectId = activeOrg ? session.profile.teacher_roster_subject_id : null;

		const target = await getStudentInterventionTarget({
			teacherId: session.user.id,
			studentId: parsed.data.studentId,
			subjectId: parsed.data.subjectId,
			forcedRosterSubjectId,
		});
		if (!target) {
			breadcrumb("no_target");
			return {
				error: "No below-target topics found for this student in the current scope.",
			};
		}

		const studentName = parsed.data.studentName?.trim() || "This student";

		try {
			const plan = await generateAtRiskInterventionPlan({
				studentName,
				target,
				recentSummary: parsed.data.riskSummary?.trim() || "Flagged as at-risk on the dashboard.",
				teacherUserId: session.user.id,
			});
			breadcrumb("plan_generated", { topicCount: plan.focusTopics.length });
			return { plan, studentName };
		} catch (err) {
			breadcrumb("plan_failed");
			return {
				error: classifyTeacherActionError(err, {
					action: "planAtRiskInterventionAction",
					userId: session.user.id,
				}).userMessage,
			};
		}
	});
}

/**
 * Publish the remedial assignment to the single at-risk student. Reuses the same
 * scope/topic validation and creation path as the full assignments form, so the
 * compact dialog cannot bypass org roster constraints or assign inactive topics.
 */
export async function publishAtRiskInterventionAction(
	raw: unknown,
): Promise<PublishAtRiskInterventionResult> {
	return withTeacherActionTelemetry("publishAtRiskInterventionAction", async (breadcrumb) => {
		const parsed = publishInputSchema.safeParse(raw);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the intervention details." };
		}

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { ok: false, message: session.message };
		}
		const { user, profile } = session;

		const rate = await consumeTeacherPortalDataActionRateLimit(user.id);
		if (!rate.ok) {
			breadcrumb("rate_limited");
			return { ok: false, message: rate.message };
		}

		const accessible = await teacherFilterAccessibleStudentIdsForSession(user.id, [parsed.data.studentId]);
		if (!accessible.has(parsed.data.studentId)) {
			breadcrumb("inaccessible_student");
			return { ok: false, message: "This student is no longer in your roster." };
		}

		const config = assignmentConfigSchema.safeParse({
			v: 1,
			kind: "practice_test",
			subject_id: parsed.data.subjectId,
			topic_ids: parsed.data.topicIds,
			difficulty: parsed.data.difficulty,
			question_count: 15,
			time_limit_seconds: 3600,
		});
		if (!config.success) {
			breadcrumb("config_invalid");
			return { ok: false, message: config.error.issues[0]?.message ?? "Invalid assignment configuration." };
		}

		const activeOrganization = await getActiveTeacherOrganizationSnapshot(user.id);
		const scopeCheck = await validatePracticeAssignmentConfigForStudents({
			activeOrganizationId: activeOrganization?.id ?? null,
			teacherRosterGrade: profile.teacher_roster_grade,
			teacherRosterSubjectId: profile.teacher_roster_subject_id,
			config: config.data,
			studentIds: [parsed.data.studentId],
		});
		if (!scopeCheck.ok) {
			breadcrumb("scope_failed");
			return { ok: false, message: scopeCheck.message };
		}

		const dueAt =
			parsed.data.dueAt && !Number.isNaN(Date.parse(parsed.data.dueAt)) ? parsed.data.dueAt : null;

		const result = await createPublishedPracticeAssignment({
			teacherId: user.id,
			organizationId: activeOrganization?.id ?? null,
			title: parsed.data.title,
			instructions: null,
			config: config.data,
			studentIds: [parsed.data.studentId],
			dueAt,
		});

		await notifyAssignmentPublished({
			teacherId: user.id,
			assignmentId: result.assignmentId,
			title: parsed.data.title,
			studentIds: [parsed.data.studentId],
		});

		void triggerPracticeWorkerInBackground().catch((error) => {
			logServerError("publishAtRiskInterventionAction.triggerPracticeWorkerInBackground", error, {
				assignmentId: result.assignmentId,
			});
		});

		breadcrumb("intervention_published", { assignmentId: result.assignmentId });
		revalidatePath("/teacher/assignments");
		revalidatePath("/teacher/submissions");
		return { ok: true, assignmentId: result.assignmentId };
	});
}
