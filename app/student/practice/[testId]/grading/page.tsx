import { notFound, redirect } from "next/navigation";

import { PracticeGradingProgressView } from "@/components/student/practice/practice-grading-progress-view";
import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ testId: string }> };

export default async function PracticeGradingPage({ params }: PageProps) {
	const { testId } = await params;
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const supabase = await createClient();

	const { data: test, error: tErr } = await supabase
		.from("tests")
		.select("id, student_id, subject_id, status, total_questions")
		.eq("id", testId)
		.maybeSingle();

	if (tErr || !test || test.student_id !== user.id) {
		notFound();
	}

	// Already finished? Open subject report and highlight this attempt.
	if (test.status === "graded") {
		redirect(
			`/student/reports?subject=${encodeURIComponent(test.subject_id as string)}&test=${encodeURIComponent(testId)}`,
		);
	}

	// Not in a grading state (e.g. still in_progress because submit never fired);
	// push the student back to the session.
	if (test.status !== "grading" && test.status !== "grading_failed") {
		redirect(`/student/practice/${testId}`);
	}

	const { data: subject } = await supabase
		.from("subjects")
		.select("name")
		.eq("id", test.subject_id as string)
		.maybeSingle();

	return (
		<PracticeGradingProgressView
			testId={testId}
			subjectId={test.subject_id as string}
			subjectName={subject?.name?.trim() ? String(subject.name) : "Subject"}
			initialStatus={test.status as "grading" | "grading_failed"}
			totalQuestions={(test.total_questions as number | null) ?? null}
		/>
	);
}
