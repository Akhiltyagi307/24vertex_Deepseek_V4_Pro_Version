import { redirect } from "next/navigation";

import { StudentReportsView } from "@/components/student/student-reports-view";
import { getServerUser } from "@/lib/auth/get-server-user";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { parseStudentReportTestRow } from "@/lib/student/subject-test-report";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParentReportsPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const activeId = await getParentActiveStudentIdFromCookie();
	if (!activeId) {
		redirect("/parent/select-student");
	}
	const ok = await assertParentActiveLink(user.id, activeId);
	if (!ok) {
		redirect("/parent/select-student");
	}

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
		.eq("student_id", activeId)
		.eq("is_draft", false)
		.in("status", ["submitted", "graded"])
		.order("test_date", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false });

	if (testsErr) {
		logSupabaseError("ParentReportsPage.tests.select", testsErr, {});
	}

	const initialTests = (testRows ?? [])
		.map((r) => parseStudentReportTestRow(r as Record<string, unknown>))
		.filter((row): row is NonNullable<typeof row> => row != null);

	return (
		<StudentReportsView
			initialTests={initialTests}
			loadError={testsErr?.message ?? null}
			parentViewer
		/>
	);
}
