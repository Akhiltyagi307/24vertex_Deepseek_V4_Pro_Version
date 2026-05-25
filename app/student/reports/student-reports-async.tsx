import { StudentReportsView } from "@/components/student/student-reports-view";
import { loadStudentReportsList } from "@/lib/student/load-student-reports-list";
import { createClient } from "@/lib/supabase/server";

type Props = {
	userId: string;
	parentViewer?: boolean;
	logContext?: string;
};

/** Streamed under <Suspense> — the tests select can take a few hundred ms on cold connections. */
export async function StudentReportsAsync({ userId, parentViewer, logContext }: Props) {
	const supabase = await createClient();

	const { tests: initialTests, loadError, hasOlderOutsideWindow } = await loadStudentReportsList(
		supabase,
		userId,
		{ logContext: logContext ?? "StudentReportsPage.tests.select" },
	);

	return (
		<StudentReportsView
			initialTests={initialTests}
			loadError={loadError}
			hasOlderOutsideWindow={hasOlderOutsideWindow}
			parentViewer={parentViewer}
		/>
	);
}
