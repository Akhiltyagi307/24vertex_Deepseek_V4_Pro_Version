"use server";

import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { teacherDashboardCacheTag } from "../dashboard/teacher-dashboard-data";

import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
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
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { linkTeacherStudentSchema } from "@/lib/validations/auth";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export type TeacherOrganizationState = { error?: string; success?: boolean };
export type TeacherLinkStudentState = { error?: string; success?: boolean };

const organizationIdSchema = z.string().uuid();

function messageForTeacherLinkError(message: string): string {
	if (/organization roster/i.test(message)) {
		return "You're connected to an organization. Manage students from Link Student, not link codes.";
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
	return withTeacherActionTelemetry("joinTeacherOrganization", async (breadcrumb) => {
	const organizationId = String(formData.get("organizationId") ?? "").trim();
	if (!organizationIdSchema.safeParse(organizationId).success) {
		breadcrumb("validation_failed", { field: "organizationId" });
		return { error: "Choose an organization." };
	}

	const linkingCodeNormalized = normalizeOrganizationLinkingCodeInput(String(formData.get("organizationLinkingCode") ?? ""));
	if (!organizationLinkingCodeRegex.test(linkingCodeNormalized)) {
		breadcrumb("validation_failed", { field: "linkingCode" });
		return {
			error:
				"Enter the 8-character organization linking code from your school administrator (letters A–Z and digits 2–9 only).",
		};
	}

	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		breadcrumb("auth_failed", { code: session.code });
		return { error: session.message };
	}
	const { user } = session;
	const supabase = await createClient();

	const [previousOrganization, nextOrganization] = await Promise.all([
		getActiveTeacherOrganizationSnapshot(user.id),
		getOrganizationById(organizationId),
	]);
	if (!nextOrganization?.is_active) {
		breadcrumb("inactive_organization");
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
		breadcrumb("rpc_failed");
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

	breadcrumb("organization_joined", { changed: previousOrganization?.id !== nextOrganization.id });
	revalidatePath("/teacher", "layout");
	revalidatePath("/teacher/settings");
	revalidatePath("/teacher/student-performance");
	revalidatePath("/teacher/topic-performance");
	revalidateTag(teacherDashboardCacheTag(user.id), "max");
	return { success: true };
	});
}

export async function leaveTeacherOrganization(
	_prev: TeacherOrganizationState | undefined,
	_formData: FormData,
): Promise<TeacherOrganizationState> {
	return withTeacherActionTelemetry("leaveTeacherOrganization", async (breadcrumb) => {
		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const { user } = session;
		const supabase = await createClient();

		const previousOrganization = await getActiveTeacherOrganizationSnapshot(user.id);
		const { error } = await supabase.rpc("teacher_leave_organization");
		if (error) {
			breadcrumb("rpc_failed");
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

		breadcrumb("organization_left", { hadPrevious: previousOrganization != null });
		revalidatePath("/teacher", "layout");
		revalidatePath("/teacher/settings");
		revalidatePath("/teacher/student-performance");
		revalidatePath("/teacher/topic-performance");
		revalidateTag(teacherDashboardCacheTag(user.id), "max");
		return { success: true };
	});
}

export async function linkTeacherToStudent(
	_prev: TeacherLinkStudentState | undefined,
	formData: FormData,
): Promise<TeacherLinkStudentState> {
	return withTeacherActionTelemetry("linkTeacherToStudent", async (breadcrumb) => {
		const parsed = linkTeacherStudentSchema.safeParse({
			studentId: formData.get("studentId"),
		});
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { error: parsed.error.issues[0]?.message ?? "Invalid link code." };
		}

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const { user } = session;
		const supabase = await createClient();
		const reqHeaders = await headers();
		const ip = clientIpFromHeaders(reqHeaders);

		const { error } = await supabase.rpc("link_teacher_to_student", {
			p_student_ref: parsed.data.studentId,
		});
		if (error) {
			breadcrumb("rpc_failed");
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

		breadcrumb("student_linked");
		revalidatePath("/teacher", "layout");
		revalidatePath("/teacher/students");
		revalidatePath("/teacher/settings");
		revalidatePath("/teacher/student-performance");
		revalidatePath("/teacher/topic-performance");
		revalidateTag(teacherDashboardCacheTag(user.id), "max");
		return { success: true };
	});
}

export async function unlinkTeacherFromStudent(
	_prev: TeacherLinkStudentState | undefined,
	formData: FormData,
): Promise<TeacherLinkStudentState> {
	return withTeacherActionTelemetry("unlinkTeacherFromStudent", async (breadcrumb) => {
		const studentId = String(formData.get("studentId") ?? "").trim();
		if (!z.string().uuid().safeParse(studentId).success) {
			breadcrumb("validation_failed");
			return { error: "Invalid student record." };
		}

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const supabase = await createClient();

		// Tenant boundary: `unlink_teacher_from_student` filters on
		// `teacher_id = auth.uid() AND student_id = p_student_id` server-side
		// (supabase/migrations/20260617103000_teacher_roster_and_unlink_student.sql:127),
		// so an unrelated student id resolves to a no-op rather than a cross-tenant write.
		const { error } = await supabase.rpc("unlink_teacher_from_student", {
			p_student_id: studentId,
		});
		if (error) {
			breadcrumb("rpc_failed");
			logSupabaseError("unlinkTeacherFromStudent.unlink_teacher_from_student", error);
			return { error: messageForTeacherLinkError(error.message) };
		}

		breadcrumb("student_unlinked");
		revalidatePath("/teacher", "layout");
		revalidatePath("/teacher/students");
		revalidatePath("/teacher/settings");
		revalidatePath("/teacher/student-performance");
		revalidatePath("/teacher/topic-performance");
		revalidateTag(teacherDashboardCacheTag(session.user.id), "max");
		return { success: true };
	});
}
