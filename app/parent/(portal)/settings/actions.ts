"use server";

import { revalidatePath } from "next/cache";

import { getServerUser } from "@/lib/auth/get-server-user";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { isOwnSupabaseAvatarUrl } from "@/lib/supabase/avatar-storage-url";
import { parentProfileUpdateSchema } from "@/lib/validations/auth";

export type UpdateParentProfileState = { error?: string; success?: boolean };

export async function updateParentProfile(
	_prev: UpdateParentProfileState | undefined,
	formData: FormData,
): Promise<UpdateParentProfileState> {
	const raw = {
		fullName: formData.get("fullName"),
		avatarUrl: formData.get("avatarUrl"),
		phone: formData.get("phone"),
	};
	const parsed = parentProfileUpdateSchema.safeParse(raw);
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

	if (fetchError || !row || row.role !== "parent") {
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
		.eq("id", user.id)
		.eq("role", "parent");

	if (updateError) {
		logSupabaseError("updateParentProfile.profiles.update", updateError);
		return { error: "We couldn't save your profile. Try again." };
	}

	revalidatePath("/parent", "layout");
	revalidatePath("/parent/settings");
	return { success: true };
}
