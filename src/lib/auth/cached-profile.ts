import "server-only";

import { cache } from "react";

import { getServerUser } from "@/lib/auth/get-server-user";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

/**
 * Single `profiles` select shared across the RSC tree via React `cache()` (one round trip per request).
 * Add columns here when a server route needs more fields from the same row.
 */
export const CACHED_APP_PROFILE_SELECT =
	"id, role, is_verified, full_name, school_name, avatar_url, grade, section, student_link_code, stream, elective_subject_id, phone, parent_email, parent_name, created_at" as const;

export type AppProfileRow = {
	id: string;
	role: string;
	is_verified: boolean | null;
	full_name: string;
	school_name: string | null;
	avatar_url: string | null;
	grade: number | null;
	section: string | null;
	student_link_code: string | null;
	stream: string | null;
	elective_subject_id: string | null;
	phone: string | null;
	parent_email: string | null;
	parent_name: string | null;
	created_at: string | null;
};

export const getCachedAppProfileRow = cache(async (): Promise<AppProfileRow | null> => {
	const user = await getServerUser();
	if (!user) return null;

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("profiles")
		.select(CACHED_APP_PROFILE_SELECT)
		.eq("id", user.id)
		.maybeSingle();

	if (error) {
		logSupabaseError("getCachedAppProfileRow.profiles.select", error, { userId: user.id });
		return null;
	}
	if (!data) return null;
	return data as AppProfileRow;
});

/**
 * One cached `profiles` read per RSC request (alias for {@link getCachedAppProfileRow}).
 * Use this name when wiring student routes; extend {@link CACHED_APP_PROFILE_SELECT} if a route needs more columns.
 */
export const getStudentProfileForSession = getCachedAppProfileRow;
