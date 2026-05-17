"use server";

import { z } from "zod";

import {
	listTeacherAssignableStudents,
	resolvePracticeAssignmentEligibleStudentIds,
} from "@/lib/assignments/queries";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";

const payloadSchema = z.object({
	subjectId: z.string().uuid(),
	topicIds: z.array(z.string().uuid()).max(20),
	candidateStudentIds: z.array(z.string().uuid()).max(500),
});

export type PreviewEligibleStudentIdsResult =
	| { eligibleStudentIds: string[] }
	| { error: string };

/**
 * Returns the roster student ids that remain eligible for the current assignment config
 * after section/performance filtering.
 */
export async function previewEligibleStudentIdsForPracticeAssignment(
	raw: unknown,
): Promise<PreviewEligibleStudentIdsResult> {
	const parsed = payloadSchema.safeParse(raw);
	if (!parsed.success) {
		return { error: parsed.error.flatten().formErrors[0] ?? "Invalid request." };
	}

	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		return { error: session.message };
	}

	const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
	if (!rate.ok) {
		return { error: rate.message };
	}

	const assignable = await listTeacherAssignableStudents(session.user.id);
	const assignableSet = new Set(assignable.map((student) => student.id));
	const candidateStudentIds = [...new Set(parsed.data.candidateStudentIds)].filter((id) =>
		assignableSet.has(id),
	);
	if (candidateStudentIds.length === 0) {
		return { eligibleStudentIds: [] };
	}

	const activeOrganization = await getActiveTeacherOrganizationSnapshot(session.user.id);
	const eligibility = await resolvePracticeAssignmentEligibleStudentIds({
		activeOrganizationId: activeOrganization?.id ?? null,
		teacherRosterGrade: session.profile.teacher_roster_grade,
		teacherRosterSubjectId: session.profile.teacher_roster_subject_id,
		config: {
			v: 1,
			kind: "practice_test",
			subject_id: parsed.data.subjectId,
			topic_ids: parsed.data.topicIds,
			difficulty: "medium",
			question_count: 15,
			time_limit_seconds: 3600,
		},
		studentIds: candidateStudentIds,
	});

	if (!eligibility.ok) {
		return { error: eligibility.message };
	}

	return { eligibleStudentIds: eligibility.eligibleStudentIds };
}
