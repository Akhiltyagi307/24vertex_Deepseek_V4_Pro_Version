import { Suspense } from "react";

import { StudentReportsAsync } from "./student-reports-async";
import { StudentReportsSkeleton } from "./student-reports-skeleton";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports" };

export default async function StudentReportsPage() {
	const { user } = await requireVerifiedStudent();

	return (
		<Suspense fallback={<StudentReportsSkeleton />}>
			<StudentReportsAsync userId={user.id} />
		</Suspense>
	);
}
