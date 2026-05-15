"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { resolveStudentProfileIdForLinkRef } from "@/lib/auth/resolve-student-link-ref";
import { notifyTeacherLinkedStudent, notifyTeacherOrganizationChanged } from "@/lib/notifications/organization-events";
import { writeOrganizationAccessAudit } from "@/lib/organizations/audit";
import { ORGANIZATION_ACCESS_ACTIONS } from "@/lib/organizations/audit-actions";
import {
	normalizeOrganizationLinkingCodeInput,
	organizationLinkingCodeRegex,
} from "@/lib/organizations/linking-code";
import {
	countActiveTeacherStudentLinks,
	getActiveTeacherOrganizationSnapshot,
	getOrganizationById,
} from "@/lib/organizations/queries";
import { createClient } from "@/lib/supabase/server";
import { linkTeacherStudentSchema } from "@/lib/validations/auth";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export type TeacherOrganizationState = { error?: string; success?: boolean };
export type TeacherLinkStudentState = { error?: string; success?: boolean };

function messageForTeacherLinkError(message: string): string {
	if (/organization roster/i.test(message)) {
		return "You're connected to an organization — manage students from Link Student, not link codes.";
	}
	if (/organization/i.test(message)) {
		return "Teachers connected to a school or tuition center cannot link students by code.";
	}
	if (/invalid student link code/i.test(message)) {
		return "Use the student's six-character link code from Profile (e.g. AB1234).";
	}
	if (/student not found/i.test(message)) {
		return "No student matched that link code. Ask the student for the six-character code from Profile.";
	}
	if (/verified teacher/i.test(message)) {
		return "Your teacher account must be approved before linking students.";
	}
	return "We couldn't link that student. Try again.";
}

export async function joinTeacherOrganization(
	_prev: TeacherOrganizationState | undefined,
	formData: FormData,
): Promise<TeacherOrganizationState> {
	const organizationId = String(formData.get("organizationId") ?? "").trim();
	if (!organizationId) {
		return { error: "Choose an organization." };
	}

	const linkingCodeNormalized = normalizeOrganizationLinkingCodeInput(String(formData.get("organizationLinkingCode") ?? ""));
	if (!organizationLinkingCodeRegex.test(linkingCodeNormalized)) {
		return {
			error:
				"Enter the 8-character organization linking code from your school administrator (letters A–Z and digits 2–9 only).",
		};
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { error: "Not signed in." };
	}

	const [previousOrganization, nextOrganization] = await Promise.all([
		getActiveTeacherOrganizationSnapshot(user.id),
		getOrganizationById(organizationId),
	]);
	if (!nextOrganization?.is_active) {
		return { error: "Choose an active organization." };
	}

	// Read link count BEFORE the RPC, which revokes all active links as a side-effect.
	// Only needed when the org is actually changing; zero-cost when rejoining the same org.
	const activeLinkCount =
		previousOrganization?.id !== nextOrganization.id
			? await countActiveTeacherStudentLinks(user.id)
			: 0;

	const { error } = await supabase.rpc("teacher_join_organization", {
		p_organization_id: organizationId,
		p_linking_code: linkingCodeNormalized,
	});
	if (error) {
		logSupabaseError("joinTeacherOrganization.teacher_join_organization", error);
		const msg = error.message ?? "";
		if (/organization linking code required/i.test(msg)) {
			return { error: "Organization linking code is required." };
		}
		if (/invalid organization or linking code/i.test(msg)) {
			return {
				error:
					"The organization or linking code doesn’t match. Confirm you picked the right school and copied the code exactly.",
			};
		}
		return { error: "We couldn't connect your teacher account to that organization." };
	}

	if (previousOrganization?.id !== nextOrganization.id) {
		const reqHeaders = await headers();
		const ip = clientIpFromHeaders(reqHeaders);
		await writeOrganizationAccessAudit({
			action: ORGANIZATION_ACCESS_ACTIONS.TEACHER_ORGANIZATION_JOIN,
			actorId: user.id,
			entityType: "organization",
			entityId: nextOrganization.id,
			changes: {
				previous_organization_id: previousOrganization?.id ?? null,
				next_organization_id: nextOrganization.id,
				revoked_teacher_student_links: activeLinkCount,
			},
			ipAddress: ip,
		});
		if (previousOrganization) {
			await notifyTeacherOrganizationChanged({
				teacherId: user.id,
				organizationId: previousOrganization.id,
				organizationName: previousOrganization.name,
				action: "left",
			});
		}
		await notifyTeacherOrganizationChanged({
			teacherId: user.id,
			organizationId: nextOrganization.id,
			organizationName: nextOrganization.name,
			action: "joined",
			revokedLinksCount: activeLinkCount,
		});
	}

	revalidatePath("/teacher", "layout");
	revalidatePath("/teacher/settings");
	revalidatePath("/teacher/student-performance");
	return { success: true };
}

export async function leaveTeacherOrganization(
	_prev: TeacherOrganizationState | undefined,
	_formData: FormData,
): Promise<TeacherOrganizationState> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { error: "Not signed in." };
	}

	const previousOrganization = await getActiveTeacherOrganizationSnapshot(user.id);
	const { error } = await supabase.rpc("teacher_leave_organization");
	if (error) {
		logSupabaseError("leaveTeacherOrganization.teacher_leave_organization", error);
		return { error: "We couldn't disconnect your teacher account from this organization." };
	}

	if (previousOrganization) {
		const reqHeaders = await headers();
		const ip = clientIpFromHeaders(reqHeaders);
		await writeOrganizationAccessAudit({
			action: ORGANIZATION_ACCESS_ACTIONS.TEACHER_ORGANIZATION_LEAVE,
			actorId: user.id,
			entityType: "organization",
			entityId: previousOrganization.id,
			changes: { previous_organization_id: previousOrganization.id, next_organization_id: null },
			ipAddress: ip,
		});
		await notifyTeacherOrganizationChanged({
			teacherId: user.id,
			organizationId: previousOrganization.id,
			organizationName: previousOrganization.name,
			action: "left",
		});
	}

	revalidatePath("/teacher", "layout");
	revalidatePath("/teacher/settings");
	revalidatePath("/teacher/student-performance");
	return { success: true };
}

export async function linkTeacherToStudent(
	_prev: TeacherLinkStudentState | undefined,
	formData: FormData,
): Promise<TeacherLinkStudentState> {
	const parsed = linkTeacherStudentSchema.safeParse({
		studentId: formData.get("studentId"),
	});
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid link code." };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { error: "Not signed in." };
	}
	const reqHeaders = await headers();
	const ip = clientIpFromHeaders(reqHeaders);

	const { error } = await supabase.rpc("link_teacher_to_student", {
		p_student_ref: parsed.data.studentId,
	});
	if (error) {
		logSupabaseError("linkTeacherToStudent.link_teacher_to_student", error);
		await writeOrganizationAccessAudit({
			action: ORGANIZATION_ACCESS_ACTIONS.TEACHER_STUDENT_LINK_FAILED,
			actorId: user.id,
			entityType: "student",
			changes: { link_ref: parsed.data.studentId, raw_message: error.message },
			ipAddress: ip,
		});
		return { error: messageForTeacherLinkError(error.message) };
	}

	const studentId = await resolveStudentProfileIdForLinkRef(supabase, parsed.data.studentId);
	await writeOrganizationAccessAudit({
		action: ORGANIZATION_ACCESS_ACTIONS.TEACHER_STUDENT_LINK_SUCCESS,
		actorId: user.id,
		entityType: "student",
		entityId: studentId ?? null,
		changes: { link_ref: parsed.data.studentId },
		ipAddress: ip,
	});
	if (studentId) {
		await notifyTeacherLinkedStudent({ teacherId: user.id, studentId });
	}

	revalidatePath("/teacher", "layout");
	revalidatePath("/teacher/students");
	revalidatePath("/teacher/settings");
	revalidatePath("/teacher/student-performance");
	return { success: true };
}

export async function unlinkTeacherFromStudent(
	_prev: TeacherLinkStudentState | undefined,
	formData: FormData,
): Promise<TeacherLinkStudentState> {
	const studentId = String(formData.get("studentId") ?? "").trim();
	if (!z.string().uuid().safeParse(studentId).success) {
		return { error: "Invalid student record." };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { error: "Not signed in." };
	}

	const { error } = await supabase.rpc("unlink_teacher_from_student", {
		p_student_id: studentId,
	});
	if (error) {
		logSupabaseError("unlinkTeacherFromStudent.unlink_teacher_from_student", error);
		return { error: messageForTeacherLinkError(error.message) };
	}

	revalidatePath("/teacher", "layout");
	revalidatePath("/teacher/students");
	revalidatePath("/teacher/settings");
	revalidatePath("/teacher/student-performance");
	return { success: true };
}
