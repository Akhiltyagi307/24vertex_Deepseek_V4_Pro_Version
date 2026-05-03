import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentPerformanceAsync } from "./student-performance-async";
import { StudentPerformanceSkeleton } from "./student-performance-skeleton";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function StudentPerformancePage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
	}

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
