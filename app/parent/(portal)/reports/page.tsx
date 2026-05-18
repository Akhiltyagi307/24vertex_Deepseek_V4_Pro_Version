import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentReportsAsync } from "../../../student/reports/student-reports-async";
import { StudentReportsSkeleton } from "../../../student/reports/student-reports-skeleton";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Reports · Parent",
	description: "Open and download your child's practice test reports.",
	robots: { index: false, follow: false },
};

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

	return (
		<Suspense fallback={<StudentReportsSkeleton />}>
			<StudentReportsAsync
				userId={activeId}
				parentViewer
				logContext="ParentReportsPage.tests.select"
			/>
		</Suspense>
	);
}
