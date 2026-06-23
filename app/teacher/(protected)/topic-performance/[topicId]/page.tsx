import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { topics } from "@/db/schema/academic";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { listTeacherTopicStudentBreakdown } from "@/lib/teachers/teacher-topic-performance-queries";
import { coerceFiltersToScope, getTeacherSubjectScope } from "@/lib/teachers/teacher-subject-scope";

// Authenticated teacher topic breakdowns are roster-scoped and should not be statically cached.
export const dynamic = "force-dynamic";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
	params: Promise<{ topicId: string }>;
	searchParams: Promise<{ grade?: string; section?: string; subject?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { topicId } = await params;
	if (!UUID_RE.test(topicId)) {
		return { title: "Topic breakdown", robots: { index: false, follow: false } };
	}
	let topicName: string | null = null;
	try {
		const [row] = await db
			.select({ topicName: topics.topicName })
			.from(topics)
			.where(eq(topics.id, topicId))
			.limit(1);
		topicName = row?.topicName?.trim() || null;
	} catch {
		topicName = null;
	}
	return {
		title: topicName ? `${topicName} · Topic breakdown` : "Topic breakdown",
		robots: { index: false, follow: false },
	};
}

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

	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user } = session;

	const activeOrg = await getActiveTeacherOrganizationSnapshot(user.id);
	const sp = await searchParams;
	const filters = parseFilters(sp);
	const scope = await getTeacherSubjectScope({
		activeOrganizationId: activeOrg?.id ?? null,
		subjectsTaught: session.profile.subjects_taught,
	});
	const coerced = coerceFiltersToScope(scope, {
		grade: filters.grade ?? "all",
		subjectId: filters.subjectId ?? "all",
	});
	const effectiveFilters = {
		grade: coerced.grade === "all" ? undefined : coerced.grade,
		section: filters.section,
		subjectId: coerced.subjectId === "all" ? undefined : coerced.subjectId,
	};

	const { topicLabel, chapterNumber, subjectName, topicSubjectId, rows } =
		await listTeacherTopicStudentBreakdown({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		topicId,
		grade: effectiveFilters.grade,
		section: effectiveFilters.section,
		subjectId: effectiveFilters.subjectId,
		gradesInScope: scope.isScoped ? scope.grades : undefined,
	});

	const backHref = breakdownListHref(effectiveFilters);

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-4 medium:px-6 medium:py-6">
			<p className="mb-4 text-muted-foreground text-sm">
				<Link href={backHref} className="underline underline-offset-4 hover:text-foreground">
					Topic performance
				</Link>
				<span aria-hidden className="px-1.5 text-muted-foreground/70">
					/
				</span>
				<span className="text-foreground">
					{chapterNumber != null ? (
						<>
							<span className="tabular-nums text-muted-foreground">Ch {chapterNumber}</span>
							<span className="text-muted-foreground/70"> · </span>
						</>
					) : null}
					{topicLabel}
				</span>
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
					<table className="w-full min-w-[40rem] border-collapse text-sm">
						<caption className="sr-only">Per-student averages and test counts for this topic</caption>
						<thead>
							<tr className="border-b border-border bg-muted/40 text-muted-foreground">
								<th scope="col" className="px-4 py-2.5 text-left font-medium text-xs">
									Student
								</th>
								<th
									scope="col"
									className="px-3 py-2.5 text-right font-medium text-xs whitespace-nowrap"
									title="Student grade"
								>
									Grade
								</th>
								<th
									scope="col"
									className="min-w-[4.5rem] px-3 py-2.5 text-right font-medium text-xs whitespace-nowrap"
									title="Class section"
								>
									Section
								</th>
								<th
									scope="col"
									className="min-w-[5.5rem] px-3 py-2.5 text-right font-medium text-xs whitespace-nowrap"
									title="Average score on this topic from graded practice"
								>
									Topic average
								</th>
								<th
									scope="col"
									className="min-w-[5.25rem] px-3 py-2.5 text-right font-medium text-xs whitespace-nowrap"
									title="Graded practice tests completed on this topic"
								>
									Tests taken
								</th>
								<th scope="col" className="px-4 py-2.5 text-right font-medium text-xs">
									<span className="sr-only">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/80 bg-background">
							{rows.map((row) => (
								<tr key={row.studentId} className="align-middle">
									<td className="max-w-[16rem] px-4 py-3 font-medium">
										<span className="block truncate" title={row.fullName}>
											{row.fullName}
										</span>
									</td>
									<td className="px-3 py-3 text-right text-muted-foreground tabular-nums whitespace-nowrap">
										{row.grade ?? "—"}
									</td>
									<td className="px-3 py-3 text-right text-muted-foreground whitespace-nowrap">
										{row.section?.trim() || "—"}
									</td>
									<td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{row.averagePercent}%</td>
									<td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{row.testsTaken}</td>
									<td className="px-4 py-3 text-right">
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
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
