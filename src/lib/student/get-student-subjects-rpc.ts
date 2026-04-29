import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type GetStudentSubjectsParams = {
	p_grade: number | null;
	p_stream: string | null;
	p_elective_id: string | null;
};

function isMissingFunctionError(error: PostgrestError | null): boolean {
	if (!error) return false;
	return error.code === "PGRST202" && error.message.includes("get_student_subjects");
}

export async function getStudentSubjectsRpc<T>(
	supabase: SupabaseClient,
	params: GetStudentSubjectsParams,
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
	const primary = await supabase.rpc("get_student_subjects", params);
	if (!isMissingFunctionError(primary.error)) {
		return primary as { data: T[] | null; error: PostgrestError | null };
	}

	const fallback = await supabase.rpc("get_student_subjects", {
		p_grade: params.p_grade,
		p_stream: params.p_stream,
		p_elective_subject_id: params.p_elective_id,
	});

	if (!fallback.error) {
		return fallback as { data: T[] | null; error: PostgrestError | null };
	}

	if (isMissingFunctionError(fallback.error) && params.p_grade != null) {
		const subjectsQuery = supabase
			.from("subjects")
			.select("*")
			.eq("grade", params.p_grade)
			.eq("is_active", true);

		if (params.p_grade >= 6 && params.p_grade <= 10) {
			const { data, error } = await subjectsQuery.eq("is_elective", false).order("sort_order", { ascending: true });
			if (!error) {
				return { data: (data ?? []) as T[], error: null };
			}
		}

		if (params.p_grade === 11 || params.p_grade === 12) {
			const { data, error } = await subjectsQuery.order("sort_order", { ascending: true });
			if (!error) {
				const filtered = (data ?? []).filter((row: Record<string, unknown>) => {
					const rowId = row.id == null ? null : String(row.id);
					const stream = row.stream == null ? null : String(row.stream);
					const isElective = row.is_elective === true;
					return (!isElective && (stream == null || stream === params.p_stream)) || rowId === params.p_elective_id;
				});
				return { data: filtered as T[], error: null };
			}
		}
	}

	return primary as { data: T[] | null; error: PostgrestError | null };
}
