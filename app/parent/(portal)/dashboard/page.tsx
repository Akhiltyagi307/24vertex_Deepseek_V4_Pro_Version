import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentDashboardAsync } from "../../../student/dashboard/student-dashboard-async";
import { StudentDashboardSkeleton } from "../../../student/dashboard/student-dashboard-skeleton";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Dashboard · Parent",
	description: "Overview of your child's recent practice, performance, and assignments.",
	robots: { index: false, follow: false },
};

export default async function ParentDashboardPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const activeId = await getParentActiveStudentIdFromCookie();
	if (!activeId) {
		redirect("/parent/select-student");
	}

	const { row, linked } = await Sentry.startSpan(
		{ name: "parent.dashboard.prepare", op: "function" },
		async () => {
			const ok = await assertParentActiveLink(user.id, activeId);
			if (!ok) return { row: null, linked: false };
			const supabase = await createClient();
			const { data } = await supabase
				.from("profiles")
				.select("grade, section, stream, elective_subject_id, role, full_name")
				.eq("id", activeId)
				.maybeSingle();
			return { row: data, linked: true };
		},
	);
	if (!linked) {
		redirect("/parent/select-student");
	}

	if (!row || row.role !== "student") {
		redirect("/parent/select-student");
	}

	const profileRow = {
		grade: row.grade,
		section: row.section,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
		full_name: row.full_name,
	};

	return (
		<Suspense fallback={<StudentDashboardSkeleton />}>
			<StudentDashboardAsync
				userId={activeId}
				profileRow={profileRow}
				loadOpts={{ subjectCardLinkMode: "performance", performancePathPrefix: "/parent/performance" }}
				viewVariant="parent"
			/>
		</Suspense>
	);
}
