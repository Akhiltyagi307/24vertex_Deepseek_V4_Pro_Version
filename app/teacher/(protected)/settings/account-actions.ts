"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { isOwnSupabaseAvatarUrl } from "@/lib/supabase/avatar-storage-url";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { teacherProfileUpdateSchema } from "@/lib/validations/auth";

export type UpdateTeacherProfileState = { error?: string; success?: boolean };

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
