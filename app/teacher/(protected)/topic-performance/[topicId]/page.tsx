import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { listTeacherTopicStudentBreakdown } from "@/lib/teachers/teacher-topic-performance-queries";

// Authenticated teacher topic breakdowns are roster-scoped and should not be statically cached.
export const dynamic = "force-dynamic";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
	params: Promise<{ topicId: string }>;
	searchParams: Promise<{ grade?: string; section?: string; subject?: string }>;
};

function parseFilters(sp: { grade?: string; section?: string; subject?: string }): {
	grade?: number | null;
	section?: string | null;
	subjectId?: string | null;
} {
	const gradeRaw = sp.grade?.trim();
	let grade: number | undefined;
	if (gradeRaw != null && gradeRaw !== "") {
		const n = Number(gradeRaw);
		if (Number.isInteger(n) && n >= 6 && n <= 12) grade = n;
	}

	const sectionRaw = sp.section?.trim();
	const section = sectionRaw && sectionRaw.length > 0 ? sectionRaw : undefined;

	const subjectRaw = sp.subject?.trim();
	const subjectId =
		subjectRaw && UUID_RE.test(subjectRaw) ? subjectRaw : undefined;

	return {
		grade,
		section,
		subjectId,
	};
}

function breakdownListHref(filters: ReturnType<typeof parseFilters>) {
	const q = new URLSearchParams();
	if (filters.grade != null) q.set("grade", String(filters.grade));
	if (filters.section) q.set("section", filters.section);
	if (filters.subjectId) q.set("subject", filters.subjectId);
	const qs = q.toString();
	return `/teacher/topic-performance${qs ? `?${qs}` : ""}`;
}

export default async function TeacherTopicPerformanceBreakdownPage({ params, searchParams }: PageProps) {
	const { topicId } = await params;
	if (!UUID_RE.test(topicId)) {
		notFound();
	}

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

	const activeOrg = await getActiveTeacherOrganizationSnapshot(user.id);
	const sp = await searchParams;
	const filters = parseFilters(sp);

	const { topicLabel, subjectName, topicSubjectId, rows } = await listTeacherTopicStudentBreakdown({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		topicId,
		grade: filters.grade,
		section: filters.section,
		subjectId: filters.subjectId,
	});

	const backHref = breakdownListHref(filters);

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
			<p className="mb-4 text-muted-foreground text-sm">
				<Link href={backHref} className="underline underline-offset-4 hover:text-foreground">
					Topic performance
				</Link>
				<span aria-hidden className="px-1.5 text-muted-foreground/70">
					/
				</span>
				<span className="text-foreground">{topicLabel}</span>
				{subjectName ? (
					<span className="text-muted-foreground"> · {subjectName}</span>
				) : null}
			</p>

			<div className="mb-6 space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Class breakdown</h1>
				<p className="text-muted-foreground text-sm">
					Averages come from each student&apos;s topic tracker (graded practice only). Students here match your roster or
					link codes, subject to the same filters as the topic list.
				</p>
			</div>

			{rows.length === 0 ? (
				<p className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-muted-foreground text-sm">
					No students in this cohort have graded practice data for this topic yet.
				</p>
			) : (
				<div className="overflow-auto rounded-lg border border-border shadow-none">
					<div className="min-w-[640px]">
						<div className="grid grid-cols-[minmax(0,1fr)_3rem_4rem_4rem_4rem_auto] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
							<span>Student</span>
							<span>Gr.</span>
							<span>Sec.</span>
							<span>Avg</span>
							<span>Tests</span>
							<span className="text-right"> </span>
						</div>
						<ul className="divide-y divide-border/80 bg-background">
							{rows.map((row) => (
								<li
									key={row.studentId}
									className="grid grid-cols-[minmax(0,1fr)_3rem_4rem_4rem_4rem_auto] items-center gap-2 px-4 py-3 text-sm"
								>
									<span className="min-w-0 truncate font-medium">{row.fullName}</span>
									<span className="text-muted-foreground tabular-nums">{row.grade ?? "—"}</span>
									<span className="text-muted-foreground">{row.section?.trim() || "—"}</span>
									<span className="tabular-nums">{row.averagePercent}%</span>
									<span className="tabular-nums">{row.testsTaken}</span>
									<div className="flex justify-end">
										<Button
											render={
												<Link
													href={`/teacher/student-performance/${row.studentId}/performance${topicSubjectId ? `?subject=${topicSubjectId}` : ""}`}
													prefetch={false}
												/>
											}
											size="sm"
											variant="outline"
											className="whitespace-nowrap"
										>
											View student
										</Button>
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
}
