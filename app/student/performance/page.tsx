import { Suspense } from "react";

import { StudentPerformanceAsync } from "./student-performance-async";
import { StudentPerformanceSkeleton } from "./student-performance-skeleton";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";

export const dynamic = "force-dynamic";

export const metadata = { title: "Performance" };

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function StudentPerformancePage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const { user, profile: row } = await requireVerifiedStudent();

	const profileRow = {
		grade: row.grade,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
	};

	return (
		<Suspense fallback={<StudentPerformanceSkeleton />}>
			<StudentPerformanceAsync
				userId={user.id}
				profileRow={profileRow}
				subjectFromUrl={sp.subject ?? null}
			/>
		</Suspense>
	);
}
