"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { isOwnSupabaseAvatarUrl } from "@/lib/supabase/avatar-storage-url";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { teacherProfileUpdateSchema, teacherTeachingFocusSchema } from "@/lib/validations/auth";

export type UpdateTeacherProfileState = { error?: string; success?: boolean };
export type UpdateTeacherTeachingFocusState = { error?: string; success?: boolean };

export async function updateTeacherProfile(
	_prev: UpdateTeacherProfileState | undefined,
	formData: FormData,
): Promise<UpdateTeacherProfileState> {
	return withTeacherActionTelemetry("updateTeacherProfile", async (breadcrumb) => {
		const raw = {
			fullName: formData.get("fullName"),
			avatarUrl: formData.get("avatarUrl"),
			phone: formData.get("phone"),
		};
		const parsed = teacherProfileUpdateSchema.safeParse(raw);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			const flat = parsed.error.flatten().fieldErrors;
			const first = Object.values(flat).flat()[0] ?? parsed.error.message;
			return { error: first };
		}
		const v = parsed.data;

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const { user, profile } = session;
		const supabase = await createClient();

		const prevAvatarNorm = profile.avatar_url?.trim() ?? "";
		const nextAvatarNorm = v.avatarUrl?.trim() ?? "";
		if (nextAvatarNorm !== "") {
			const legacyUnchanged =
				nextAvatarNorm === prevAvatarNorm && !isOwnSupabaseAvatarUrl(nextAvatarNorm, user.id);
			const validStorage = isOwnSupabaseAvatarUrl(nextAvatarNorm, user.id);
			if (!legacyUnchanged && !validStorage) {
				breadcrumb("avatar_rejected");
				return { error: "Invalid profile photo. Use Change photo to upload an image." };
			}
		}

		const { error: updateError } = await supabase
			.from("profiles")
			.update({
				full_name: v.fullName,
				avatar_url: v.avatarUrl,
				phone: v.phone,
				updated_at: new Date().toISOString(),
			})
			.eq("id", user.id)
			.eq("role", "teacher");

		if (updateError) {
			breadcrumb("supabase_update_failed");
			logSupabaseError("updateTeacherProfile.profiles.update", updateError);
			return { error: "We couldn't save your profile. Try again." };
		}

		breadcrumb("profile_updated");
		revalidatePath("/teacher", "layout");
		revalidatePath("/teacher/settings");
		return { success: true };
	});
}

export async function updateTeacherTeachingFocus(
	_prev: UpdateTeacherTeachingFocusState | undefined,
	formData: FormData,
): Promise<UpdateTeacherTeachingFocusState> {
	return withTeacherActionTelemetry("updateTeacherTeachingFocus", async (breadcrumb) => {
		const parsed = teacherTeachingFocusSchema.safeParse({
			grade: formData.get("grade"),
			subjectId: formData.get("subjectId"),
		});
		if (!parsed.success) {
			breadcrumb("validation_failed");
			const flat = parsed.error.flatten().fieldErrors;
			const first = Object.values(flat).flat()[0] ?? parsed.error.issues[0]?.message ?? "Invalid data.";
			return { error: first };
		}
		const v = parsed.data;

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}

		const activeOrg = await getActiveTeacherOrganizationSnapshot(session.user.id);
		if (!activeOrg) {
			breadcrumb("no_active_organization");
			return { error: "Join an organization before choosing grade and subject filters." };
		}

		const supabase = await createClient();

		const { data: subjectRow, error: subjectErr } = await supabase
			.from("subjects")
			.select("id, grade, is_active")
			.eq("id", v.subjectId)
			.maybeSingle();

		if (subjectErr || !subjectRow || subjectRow.is_active === false) {
			breadcrumb("subject_invalid");
			return { error: "Choose a valid subject." };
		}
		if ((subjectRow.grade as number) !== v.grade) {
			breadcrumb("subject_grade_mismatch");
			return { error: "That subject does not match the grade you selected." };
		}

		const { error: updateError } = await supabase
			.from("profiles")
			.update({
				teacher_roster_grade: v.grade,
				teacher_roster_subject_id: v.subjectId,
				updated_at: new Date().toISOString(),
			})
			.eq("id", session.user.id)
			.eq("role", "teacher");

		if (updateError) {
			breadcrumb("supabase_update_failed");
			logSupabaseError("updateTeacherTeachingFocus.profiles.update", updateError);
			return { error: "We couldn't save your teaching filters. Try again." };
		}

		breadcrumb("teaching_focus_updated");
		revalidatePath("/teacher", "layout");
		revalidatePath("/teacher/settings");
		revalidatePath("/teacher/students");
		revalidatePath("/teacher/student-performance");
		revalidatePath("/teacher/topic-performance");
		return { success: true };
	});
}
