import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentPerformanceAsync } from "../../../student/performance/student-performance-async";
import { StudentPerformanceSkeleton } from "../../../student/performance/student-performance-skeleton";
import { ParentPerformanceChartA11yWrapper } from "@/components/parent/performance-chart-a11y-wrapper";
import { ParentReviewAdvisoryPanel } from "@/components/parent/review-advisory-panel";
import { getServerUser } from "@/lib/auth/get-server-user";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { loadAdvisoryActions } from "@/lib/student/review-advisory";
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

	// The link check, the child-profile read, and the advisory load all depend only
	// on (user.id, activeId) — run them concurrently instead of as three serial
	// round-trips. RLS is the real data guard (the parent's client can only read a
	// linked child's profile/tracker), so running the reads alongside the link check
	// is safe; we still redirect on the link/role checks below before rendering.
	const supabase = await createClient();
	const [ok, row, advisoryActions] = await Promise.all([
		assertParentActiveLink(user.id, activeId),
		Sentry.startSpan({ name: "parent.performance.prepare", op: "function" }, async () => {
			const { data } = await supabase
				.from("profiles")
				.select("grade, stream, elective_subject_id, role, full_name")
				.eq("id", activeId)
				.maybeSingle();
			return data;
		}),
		loadAdvisoryActions(supabase, activeId),
	]);

	if (!ok) {
		redirect("/parent/select-student");
	}

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
			<div className="mb-5">
				<ParentReviewAdvisoryPanel actions={advisoryActions} childName={childName} />
			</div>
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
