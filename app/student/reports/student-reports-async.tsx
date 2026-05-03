import { StudentReportsView } from "@/components/student/student-reports-view";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { parseStudentReportTestRow } from "@/lib/student/subject-test-report";
import { createClient } from "@/lib/supabase/server";

type Props = {
	userId: string;
	parentViewer?: boolean;
	logContext?: string;
};

/** Streamed under <Suspense> — the tests select can take a few hundred ms on cold connections. */
export async function StudentReportsAsync({ userId, parentViewer, logContext }: Props) {
	const supabase = await createClient();

	const { data: testRows, error: testsErr } = await supabase
		.from("tests")
		.select(
			`
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
		`,
		)
		.eq("student_id", userId)
		.eq("is_draft", false)
		.in("status", ["submitted", "graded"])
		.order("test_date", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false });

	if (testsErr) {
		logSupabaseError(logContext ?? "StudentReportsPage.tests.select", testsErr, {});
	}

	const initialTests = (testRows ?? [])
		.map((r) => parseStudentReportTestRow(r as Record<string, unknown>))
		.filter((row): row is NonNullable<typeof row> => row != null);

	return (
		<StudentReportsView
			initialTests={initialTests}
			loadError={testsErr?.message ?? null}
			parentViewer={parentViewer}
		/>
	);
}
