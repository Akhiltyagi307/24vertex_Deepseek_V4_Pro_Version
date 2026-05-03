import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentReportsAsync } from "./student-reports-async";
import { StudentReportsSkeleton } from "./student-reports-skeleton";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export default async function StudentReportsPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
	}

	return (
		<Suspense fallback={<StudentReportsSkeleton />}>
			<StudentReportsAsync userId={user.id} />
		</Suspense>
	);
}
