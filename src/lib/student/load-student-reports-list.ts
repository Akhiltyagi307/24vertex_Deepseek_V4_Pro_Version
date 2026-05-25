import "server-only";

import { logSupabaseError } from "@/lib/server/log-supabase-error";
import {
	REPORTS_LIST_PAGE_SIZE,
	reportsListWindowStartIso,
} from "@/lib/student/reports-list-window";
import { parseStudentReportTestRow, type StudentReportTestRowSerialized } from "@/lib/student/subject-test-report";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const REPORTS_SELECT = `
	id,
	test_date,
	test_type,
	status,
	total_score,
	total_questions,
	correct_answers,
	unit_name,
	difficulty,
	duration_seconds,
	is_draft,
	created_at,
	subject_id,
	subjects (
		id,
		name,
		sort_order
	)
`;

function parseRows(raw: unknown[]): StudentReportTestRowSerialized[] {
	return raw
		.map((r) => parseStudentReportTestRow(r as Record<string, unknown>))
		.filter((row): row is StudentReportTestRowSerialized => row != null);
}

export async function loadStudentReportsList(
	supabase: SupabaseServer,
	userId: string,
	opts?: { beforeTestDateIso?: string; logContext?: string },
): Promise<{
	tests: StudentReportTestRowSerialized[];
	loadError: string | null;
	hasOlderOutsideWindow: boolean;
}> {
	const windowStartIso = reportsListWindowStartIso();
	const logContext = opts?.logContext ?? "loadStudentReportsList.tests.select";

	let query = supabase
		.from("tests")
		.select(REPORTS_SELECT)
		.eq("student_id", userId)
		.eq("is_draft", false)
		.in("status", ["submitted", "graded"])
		.order("test_date", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.limit(REPORTS_LIST_PAGE_SIZE);

	if (opts?.beforeTestDateIso) {
		query = query.lt("test_date", opts.beforeTestDateIso);
	} else {
		query = query.gte("test_date", windowStartIso);
	}

	const { data: testRows, error: testsErr } = await query;

	if (testsErr) {
		logSupabaseError(logContext, testsErr, { userId });
		return { tests: [], loadError: testsErr.message, hasOlderOutsideWindow: false };
	}

	let hasOlderOutsideWindow = false;
	if (!opts?.beforeTestDateIso) {
		const { count, error: countErr } = await supabase
			.from("tests")
			.select("id", { count: "exact", head: true })
			.eq("student_id", userId)
			.eq("is_draft", false)
			.in("status", ["submitted", "graded"])
			.not("test_date", "is", null)
			.lt("test_date", windowStartIso);
		if (countErr) {
			logSupabaseError(`${logContext}.older_count`, countErr, { userId });
		} else {
			hasOlderOutsideWindow = (count ?? 0) > 0;
		}
	}

	return {
		tests: parseRows(testRows ?? []),
		loadError: null,
		hasOlderOutsideWindow,
	};
}
