import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentPerformanceAsync } from "@/app/student/performance/student-performance-async";
import { StudentPerformanceSkeleton } from "@/app/student/performance/student-performance-skeleton";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { teacherCanAccessStudentForSession } from "@/lib/teachers/teacher-student-access";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
	params: Promise<{ studentId: string }>;
	searchParams: Promise<{ subject?: string }>;
};

export default async function TeacherStudentPerformanceDetailPage({ params, searchParams }: PageProps) {
	const { studentId } = await params;
	const sp = await searchParams;

	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const teacherProfile = await getCachedAppProfileRow();
	if (!teacherProfile || teacherProfile.role !== "teacher") {
		redirect("/login");
	}
	if (!teacherProfile.is_verified) {
		redirect("/teacher/pending");
	}

	const allowed = await teacherCanAccessStudentForSession(user.id, studentId);
	if (!allowed) {
		notFound();
	}

	const supabase = await createClient();
	const { data: row } = await supabase
		.from("profiles")
		.select("grade, stream, elective_subject_id, role, full_name")
		.eq("id", studentId)
		.maybeSingle();

	if (!row || row.role !== "student") {
		notFound();
	}

	const profileRow = {
		grade: row.grade,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
	};

	const displayName = formatPersonDisplayName(row.full_name ?? "") || "Student";

	return (
		<div className="w-full min-w-0 py-4 medium:py-6">
			<p className="mb-4 text-muted-foreground text-sm">
				<Link href="/teacher/student-performance" className="underline underline-offset-4 hover:text-foreground">
					Student performance
				</Link>
				<span aria-hidden className="px-1.5 text-muted-foreground/70">
					/
				</span>
				<span className="text-foreground">{displayName}</span>
			</p>

			<Suspense fallback={<StudentPerformanceSkeleton />}>
				<StudentPerformanceAsync
					userId={studentId}
					profileRow={profileRow}
					subjectFromUrl={sp.subject ?? null}
					portalBasePath={`/teacher/student-performance/${studentId}`}
					parentViewer
					viewerOverviewHref="/teacher/student-performance"
				/>
			</Suspense>
		</div>
	);
}
