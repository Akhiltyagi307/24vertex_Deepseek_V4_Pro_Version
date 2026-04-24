import type { SupabaseClient } from "@supabase/supabase-js";

import { logSupabaseError } from "@/lib/server/log-supabase-error";

export type StudentSubjectsProfileRow = {
	grade: number | null;
	stream: string | null;
	elective_subject_id: string | null;
};

export type LoadedStudentSubject = {
	id: string;
	name: string;
	sort_order: number | null;
	subject_group: string | null;
};

type RpcSubjectRow = {
	id: string;
	name: string;
	sort_order?: number | null;
	subject_group?: string | null;
};

export async function loadStudentSubjects(
	supabase: SupabaseClient,
	profileRow: StudentSubjectsProfileRow,
): Promise<{ subjects: LoadedStudentSubject[]; loadError: string | null }> {
	const { data, error } = await supabase.rpc("get_student_subjects", {
		p_grade: profileRow.grade,
		p_stream: profileRow.stream,
		p_elective_id: profileRow.elective_subject_id,
	});

	if (error) {
		logSupabaseError("loadStudentSubjects.get_student_subjects", error);
		return {
			subjects: [],
			loadError: "We couldn't load your enrolled subjects right now. Try refreshing the page.",
		};
	}

	const subjects: LoadedStudentSubject[] = ((data ?? []) as RpcSubjectRow[])
		.map((row) => ({
			id: row.id,
			name: row.name,
			sort_order: row.sort_order ?? null,
			subject_group: row.subject_group ?? null,
		}))
		.filter((subject) => Boolean(subject.id && subject.name));

	return { subjects, loadError: null };
}
