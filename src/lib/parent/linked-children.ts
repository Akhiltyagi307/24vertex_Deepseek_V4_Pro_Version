import "server-only";

import { cache } from "react";

import { CACHED_APP_PROFILE_SELECT, type AppProfileRow } from "@/lib/auth/cached-profile";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

export type LinkedChildRow = AppProfileRow;

/**
 * Active linked students for the signed-in parent (RLS: parent_id = auth.uid()).
 */
export const loadLinkedChildrenForParent = cache(async (parentUserId: string): Promise<LinkedChildRow[]> => {
	const supabase = await createClient();
	const { data: links, error: linkErr } = await supabase
		.from("parent_student_links")
		.select("student_id")
		.eq("parent_id", parentUserId)
		.eq("status", "active");

	if (linkErr) {
		logSupabaseError("loadLinkedChildrenForParent.links", linkErr, { parentUserId });
		return [];
	}

	const ids = (links ?? []).map((r) => r.student_id as string).filter(Boolean);
	if (ids.length === 0) return [];

	const { data: profiles, error: profErr } = await supabase
		.from("profiles")
		.select(CACHED_APP_PROFILE_SELECT)
		.in("id", ids)
		.eq("role", "student");

	if (profErr) {
		logSupabaseError("loadLinkedChildrenForParent.profiles", profErr, { parentUserId });
		return [];
	}

	return (profiles ?? []) as LinkedChildRow[];
});

export async function assertParentActiveLink(parentUserId: string, studentId: string): Promise<boolean> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("parent_student_links")
		.select("student_id")
		.eq("parent_id", parentUserId)
		.eq("student_id", studentId)
		.eq("status", "active")
		.maybeSingle();

	if (error) {
		logSupabaseError("assertParentActiveLink", error, { parentUserId, studentId });
		return false;
	}
	return Boolean(data);
}
