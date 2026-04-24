import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentReportsView } from "@/components/student/student-reports-view";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { parseStudentReportTestRow } from "@/lib/student/subject-test-report";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentReportsPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const supabase = await createClient();
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
	}

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
		.eq("student_id", user.id)
		.eq("is_draft", false)
		.in("status", ["submitted", "graded"])
		.order("test_date", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false });

	if (testsErr) {
		logSupabaseError("StudentReportsPage.tests.select", testsErr, {});
	}

	const initialTests = (testRows ?? [])
		.map((r) => parseStudentReportTestRow(r as Record<string, unknown>))
		.filter((row): row is NonNullable<typeof row> => row != null);

	return (
		<Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading reports…</div>}>
			<StudentReportsView initialTests={initialTests} loadError={testsErr?.message ?? null} />
		</Suspense>
	);
}
