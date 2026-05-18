import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentPerformanceAsync } from "../../../student/performance/student-performance-async";
import { StudentPerformanceSkeleton } from "../../../student/performance/student-performance-skeleton";
import { ParentPerformanceChartA11yWrapper } from "@/components/parent/performance-chart-a11y-wrapper";
import { getServerUser } from "@/lib/auth/get-server-user";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Performance · Parent",
	description: "Subject-by-subject breakdown of your child's strengths, gaps, and topic mastery.",
	robots: { index: false, follow: false },
};

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function ParentPerformancePage({ searchParams }: PageProps) {
	const sp = await searchParams;
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

	const { row } = await Sentry.startSpan(
		{ name: "parent.performance.prepare", op: "function" },
		async () => {
			const supabase = await createClient();
			const { data } = await supabase
				.from("profiles")
				.select("grade, stream, elective_subject_id, role, full_name")
				.eq("id", activeId)
				.maybeSingle();
			return { row: data };
		},
	);

	if (!row || row.role !== "student") {
		redirect("/parent/select-student");
	}

	const profileRow = {
		grade: row.grade,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
	};

	const childName = formatPersonDisplayName(row.full_name ?? "") || "your child";

	return (
		<ParentPerformanceChartA11yWrapper childName={childName}>
			<Suspense fallback={<StudentPerformanceSkeleton />}>
				<StudentPerformanceAsync
					userId={activeId}
					profileRow={profileRow}
					subjectFromUrl={sp.subject ?? null}
					portalBasePath="/parent"
					parentViewer
				/>
			</Suspense>
		</ParentPerformanceChartA11yWrapper>
	);
}
