import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { StudentPerformanceAsync } from "@/app/student/performance/student-performance-async";
import { StudentPerformanceSkeleton } from "@/app/student/performance/student-performance-skeleton";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { teacherCanAccessStudentForSession } from "@/lib/teachers/teacher-student-access";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { createClient } from "@/lib/supabase/server";

// Authenticated teacher performance detail uses per-student access checks and should not be statically cached.
export const dynamic = "force-dynamic";

type PageProps = {
	params: Promise<{ studentId: string }>;
	searchParams: Promise<{ subject?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { studentId } = await params;
	let displayName: string | null = null;
	try {
		const supabase = await createClient();
		const { data: row } = await supabase
			.from("profiles")
			.select("full_name")
			.eq("id", studentId)
			.maybeSingle();
		const formatted = row?.full_name ? formatPersonDisplayName(row.full_name) : null;
		displayName = formatted && formatted.length > 0 ? formatted : null;
	} catch {
		displayName = null;
	}
	return {
		title: displayName ? `${displayName} · Student performance` : "Student performance",
		robots: { index: false, follow: false },
	};
}

export default async function TeacherStudentPerformanceDetailPage({ params, searchParams }: PageProps) {
	const { studentId } = await params;
	const sp = await searchParams;

	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user } = session;

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
