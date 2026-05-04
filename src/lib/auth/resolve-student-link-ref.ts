import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Resolves a student profile id from the same reference accepted by
 * `link_parent_to_student` (UUID or six-character link code).
 */
export async function resolveStudentProfileIdForLinkRef(
	supabase: SupabaseClient,
	ref: string,
): Promise<string | null> {
	const trimmed = ref.trim();
	if (!trimmed) return null;

	if (z.string().uuid().safeParse(trimmed).success) {
		const { data, error } = await supabase
			.from("profiles")
			.select("id, role")
			.eq("id", trimmed)
			.maybeSingle();
		if (error || !data || data.role !== "student") return null;
		return data.id;
	}

	const code = trimmed.toUpperCase();
	const { data, error } = await supabase
		.from("profiles")
		.select("id")
		.eq("student_link_code", code)
		.eq("role", "student")
		.maybeSingle();
	if (error || !data) return null;
	return data.id;
}
