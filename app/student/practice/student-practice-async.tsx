import { SuspenseContentReveal } from "@/components/motion/suspense-content-reveal";
import { StudentPracticeView } from "@/components/student/student-practice-view";
import { loadStudentPracticePagePayload, type StudentPracticePageProfileRow } from "@/lib/practice/load-student-practice-page";
import { createClient } from "@/lib/supabase/server";

export async function StudentPracticeAsync({
	userId,
	profileRow,
}: {
	userId: string;
	profileRow: StudentPracticePageProfileRow;
}) {
	const supabase = await createClient();
	const practicePayload = await loadStudentPracticePagePayload(supabase, userId, profileRow);
	return (
		<SuspenseContentReveal>
			<StudentPracticeView {...practicePayload} />
		</SuspenseContentReveal>
	);
}
