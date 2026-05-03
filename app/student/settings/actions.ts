"use server";

import { revalidatePath } from "next/cache";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { isOwnSupabaseAvatarUrl } from "@/lib/supabase/avatar-storage-url";
import {
	studentProfileUpdateSchema,
	studentSchoolPlacementSchema,
} from "@/lib/validations/auth";

export type UpdateStudentProfileState = { error?: string; success?: boolean };

export async function updateStudentProfile(
	_prev: UpdateStudentProfileState | undefined,
	formData: FormData,
): Promise<UpdateStudentProfileState> {
	const raw = {
		fullName: formData.get("fullName"),
		avatarUrl: formData.get("avatarUrl"),
		phone: formData.get("phone"),
	};
	const parsed = studentProfileUpdateSchema.safeParse(raw);
	if (!parsed.success) {
		const flat = parsed.error.flatten().fieldErrors;
		const first = Object.values(flat).flat()[0] ?? parsed.error.message;
		return { error: first };
	}
	const v = parsed.data;

	const user = await getServerUser();
	if (!user) {
		return { error: "Not signed in." };
	}
	const supabase = await createClient();

	const { data: row, error: fetchError } = await supabase
		.from("profiles")
		.select("id, role, avatar_url")
		.eq("id", user.id)
		.maybeSingle();

	if (fetchError || !row || row.role !== "student") {
		return { error: "Profile not found." };
	}

	const prevAvatarNorm = row.avatar_url?.trim() ?? "";
	const nextAvatarNorm = v.avatarUrl?.trim() ?? "";
	if (nextAvatarNorm !== "") {
		const legacyUnchanged =
			nextAvatarNorm === prevAvatarNorm && !isOwnSupabaseAvatarUrl(nextAvatarNorm, user.id);
		const validStorage = isOwnSupabaseAvatarUrl(nextAvatarNorm, user.id);
		if (!legacyUnchanged && !validStorage) {
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
		.eq("id", user.id);

	if (updateError) {
		logSupabaseError("updateStudentProfile.profiles.update", updateError);
		return { error: "We couldn't save your profile. Try again." };
	}

	revalidatePath("/student", "layout");
	return { success: true };
}

export async function updateStudentSchoolPlacement(
	raw: unknown,
): Promise<UpdateStudentProfileState> {
	const parsed = studentSchoolPlacementSchema.safeParse(raw);
	if (!parsed.success) {
		const flat = parsed.error.flatten();
		const first =
			Object.values(flat.fieldErrors).flat()[0] ?? parsed.error.issues[0]?.message ?? "Invalid data.";
		return { error: first };
	}
	const v = parsed.data;

	const user = await getServerUser();
	if (!user) {
		return { error: "Not signed in." };
	}
	const supabase = await createClient();

	const { data: row, error: fetchError } = await supabase
		.from("profiles")
		.select("id, role, grade, stream, elective_subject_id")
		.eq("id", user.id)
		.maybeSingle();

	if (fetchError || !row || row.role !== "student") {
		return { error: "Profile not found." };
	}

	const stream = v.grade >= 11 ? v.stream : null;
	const electiveId = v.grade >= 11 ? (v.electiveSubjectId ?? null) : null;

	const prevGrade = row.grade as number | null;
	const prevStream = (row.stream as string | null) ?? null;
	const prevElective = (row.elective_subject_id as string | null) ?? null;
	const curriculumChanged =
		prevGrade !== v.grade ||
		prevStream !== (stream ?? null) ||
		prevElective !== (electiveId ?? null);

	if (electiveId) {
		const { data: subj, error: subjErr } = await supabase
			.from("subjects")
			.select("id, is_elective, grade, stream, is_active")
			.eq("id", electiveId)
			.maybeSingle();

		if (subjErr || !subj || !subj.is_elective || (subj.grade as number) !== v.grade || subj.is_active === false) {
			return { error: "Choose a valid elective for your grade." };
		}
		const subjStream = subj.stream as string | null;
		if (subjStream && stream && subjStream !== stream) {
			return { error: "That elective does not match your stream." };
		}
	}

	const { error: updateError } = await supabase
		.from("profiles")
		.update({
			grade: v.grade,
			section: v.section.trim(),
			stream,
			elective_subject_id: electiveId,
			school_name: v.schoolName,
			updated_at: new Date().toISOString(),
		})
		.eq("id", user.id);

	if (updateError) {
		logSupabaseError("updateStudentSchoolPlacement.profiles.update", updateError);
		return { error: "We couldn't save your school details. Try again." };
	}

	if (curriculumChanged) {
		const { error: syncError } = await supabase.rpc("sync_student_performance_tracker", {
			p_reset_curriculum: true,
		});
		if (syncError) {
			logSupabaseError("updateStudentSchoolPlacement.sync_student_performance_tracker", syncError);
			return { error: "We couldn't update your curriculum tracking. Try again." };
		}
	}

	revalidatePath("/student", "layout");
	return { success: true };
}
